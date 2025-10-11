from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import base64
import json
import logging
import os
import uvicorn

from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_api_key = os.getenv("GEMINI_API_KEY")

if not gemini_api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Add it to your environment or `.env` file before starting the server."
    )

client = genai.Client(api_key=gemini_api_key)

INLINE_ASSISTANT_MODEL = os.getenv("INLINE_ASSISTANT_MODEL", "gemini-2.5-pro")
MAX_SELECTION_CHARS = 1000
MAX_LINKS = 40
ERROR_CONTEXT_MAX_CHARS = 4000


class ExplainCodeRequest(BaseModel):
    snippet: str
    language: str | None = None
    url: str | None = None
    title: str | None = None

class PageLink(BaseModel):
    text: str
    url: str

class AnalyzeRequest(BaseModel):
    query: str
    domain: str
    url: str
    links: list[PageLink] = []
    selectionText: str | None = None


class ErrorScreenshot(BaseModel):
    mimeType: str
    data: str
    name: str | None = None


class ErrorDocsRequest(BaseModel):
    domain: str
    url: str
    links: list[PageLink] = []
    query: str | None = None
    errorText: str | None = None
    screenshot: ErrorScreenshot | None = None
    docContext: str | None = None

@app.post("/analyze")
async def analyze_history(request: AnalyzeRequest):
    try:
        if not request.query:
            raise HTTPException(status_code=400, detail="No query provided")
        
        logger.info(f"Analyzing query...")
        logger.info(f"Received {len(request.links)} links from page")
        
        if request.links:
            logger.info(f"Sample links: {request.links[:3]}")

        domain = request.domain

        tools = [
            {"url_context": {}},
        ]

        # Format links for the prompt
        links_context_lines = []
        if request.links:
            for link in request.links[:MAX_LINKS]:
                text = (link.text or "").strip()
                if text:
                    if len(text) > 90:
                        text = text[:87] + "..."
                    links_context_lines.append(f"- {text}: {link.url}")
                else:
                    links_context_lines.append(f"- {link.url}")

        links_context = "\n".join(links_context_lines) if links_context_lines else "- (no navigational links captured)"
        if links_context_lines:
            logger.info(f"Formatted {len(links_context_lines)} links for context")
        
        selection_snippet = (request.selectionText or "").strip()
        if selection_snippet:
            selection_snippet = selection_snippet[:MAX_SELECTION_CHARS]

        system_instruction = (
            "You are the inline documentation guide for YC Hack. "
            "Respond succinctly (under 180 words), prioritize immediate guidance, "
            "and cite the exact navigation path or link text when pointing to other pages."
        )

        highlighted_block = selection_snippet if selection_snippet else "(none provided)"

        prompt = f"""
### Workspace Snapshot
- Active URL: {request.url}
- Domain focus: {domain}

### Page Navigation (top {len(links_context_lines)} links)
{links_context}

### Highlighted Passage
{highlighted_block}

### Task
Question: {request.query}

### Response Guidelines
1. Address the highlighted passage first if it exists.
2. Provide clear, numbered or bulleted steps when applicable.
3. Reference the most relevant link text from the navigation list above when suggesting navigation.
4. Stick to resources on {domain} unless absolutely necessary.
"""

        logger.info("Prepared inline assistant prompt")

        response = client.models.generate_content(
            model=INLINE_ASSISTANT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=tools,
                system_instruction=system_instruction
            ),
        )

        logger.info(response.text)
        
        # Extract grounding metadata for citations
        citations = []
        grounding_supports = []
        
        try:
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                logger.info(f"Candidate: {candidate}")
                
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounding = candidate.grounding_metadata
                    logger.info(f"Grounding metadata found: {grounding}")
                    
                    # Extract grounding chunks
                    if hasattr(grounding, 'grounding_chunks') and grounding.grounding_chunks:
                        for idx, chunk in enumerate(grounding.grounding_chunks):
                            if hasattr(chunk, 'web') and chunk.web:
                                title = chunk.web.title if hasattr(chunk.web, 'title') else 'Source'
                                uri = chunk.web.uri if hasattr(chunk.web, 'uri') else ''
                                if uri:
                                    citations.append({
                                        'index': idx,
                                        'title': title,
                                        'url': uri
                                    })
                                    logger.info(f"Added citation {idx}: {title} - {uri}")
                    
                    # Extract grounding supports (which text segments map to which chunks)
                    if hasattr(grounding, 'grounding_supports') and grounding.grounding_supports:
                        for support in grounding.grounding_supports:
                            if hasattr(support, 'segment') and hasattr(support, 'grounding_chunk_indices'):
                                segment_data = {
                                    'start_index': support.segment.start_index if hasattr(support.segment, 'start_index') else 0,
                                    'end_index': support.segment.end_index if hasattr(support.segment, 'end_index') else 0,
                                    'text': support.segment.text if hasattr(support.segment, 'text') else '',
                                    'chunk_indices': list(support.grounding_chunk_indices) if support.grounding_chunk_indices else []
                                }
                                grounding_supports.append(segment_data)
                                logger.info(f"Added support: {segment_data}")
        except Exception as e:
            logger.error(f"Error extracting citations: {e}")
        
        logger.info(f"Total citations: {len(citations)}, Total supports: {len(grounding_supports)}")
        return {"result": response.text, "citations": citations, "grounding_supports": grounding_supports}
        
    except Exception as error:
        print(f"Analysis error: {error}")
        raise HTTPException(status_code=500, detail="Analysis failed")

@app.post("/explain-code")
async def explain_code(request: ExplainCodeRequest):
    if not request.snippet or not request.snippet.strip():
        raise HTTPException(status_code=400, detail="Code snippet is required")

    try:
        system_instruction = (
            "You are a meticulous code explainer."
            " Provide a concise, step-by-step explanation of the provided code snippet."
            " Highlight key operations, control flow, and important data transformations."
            " Assume the reader is technical but unfamiliar with the snippet's context."
            " Avoid speculative functionality beyond what can be inferred from the code."
            " Respond in under 220 words."
        )

        language_hint = f"Language: {request.language}\n" if request.language else ""
        source_hint = ""
        if request.url:
            source_hint += f"Source URL: {request.url}\n"
        if request.title:
            source_hint += f"Page Title: {request.title}\n"

        prompt = (
            "### Context\n"
            f"{language_hint}{source_hint}"
            "The user clicked an explain button for the following code block.\n\n"
            "### Code Snippet\n"
            "```\n"
            f"{request.snippet}\n"
            "```\n\n"
            "### Instructions\n"
            "1. Summarize the snippet's purpose in one sentence.\n"
            "2. Provide a clear, step-by-step walkthrough of what the code does.\n"
            "3. Call out important variables, functions, or API calls.\n"
            "4. Mention any assumptions or potential side effects.\n"
        )

        response = client.models.generate_content(
            model=INLINE_ASSISTANT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )

        return {"result": response.text}

    except Exception as error:
        logger.error(f"Explain code error: {error}")
        raise HTTPException(status_code=500, detail="Explain code failed")


@app.get("/")
async def root():
    return {"message": "YC Hack Server"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)