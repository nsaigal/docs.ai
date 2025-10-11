from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import uvicorn
import logging
import os

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

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class PageLink(BaseModel):
    text: str
    url: str

class AnalyzeRequest(BaseModel):
    query: str
    domain: str
    url: str
    links: list[PageLink] = []

@app.post("/analyze")
async def analyze_history(request: AnalyzeRequest):
    try:
        if not request.query:
            raise HTTPException(status_code=400, detail="No query provided")
        
        logger.info(f"Analyzing query...")

        domain = request.domain

        tools = [
            {"url_context": {}},
            # {"google_search": {}},
        ]

        config = types.GenerateContentConfig(
            tools=tools
        )

        # Format links for the prompt
        links_context = ""
        if request.links:
            links_context = "\n\nLinks available on the current page:\n"
            for link in request.links[:50]:  # Limit to first 50 links to avoid token limits
                links_context += f"- {link.text}: {link.url}\n"
        
        prompt = f'''You are an expert developer relations that will guide the user to an answer to their query.
        You will be given a query and domain of documentation.
        Use the url_context tool to analyze the current page at {request.url} and the google_search tool to find additional relevant information from the domain {domain}.
        Provide only the most relevant citation for your answer.
        Only use the domain {domain} for your search. Contextualize your answer with the domain {domain}.
        Here is the current URL: {request.url}
        {links_context}
        
        Query: {request.query}
        '''

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=config,
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

@app.get("/")
async def root():
    return {"message": "YC Hack Server"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)