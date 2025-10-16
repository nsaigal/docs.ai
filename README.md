<img src="logo.png" alt="Docs.ai Logo" width="125">

# Docs.ai
A YC hackathon project from [Neil](https://www.linkedin.com/in/neil-saigal-91b2219b/) & [Nikash](http://linkedin.com/in/nikash-bhardwaj/)

Demo video: https://drive.google.com/file/d/1VQotlAA2TNYMgE3-kmbJAmSf3pj5PNs-/view?usp=sharing

## What problem does this solve?
- Dev tool teams keep losing developers at the “wait, how do I…?” moment. `YC Hack` drops a friendly expert right into their docs, so folks get unblocked faster and support queues stay manageable, giving dev a personalized developer relations rep for your company.
- It’s a Chrome side-panel co-pilot that grabs the live page DOM, sends natural-language questions to a Gemini-powered FastAPI service, and returns grounded answers with links you can actually click.
- A Pipecat + Tavus avatar echoes every answer: once you hit Connect, we stream your mic into Pipecat, let Gemini respond, and Tavus delivers a synced face + voice so it feels like you’re chatting with a real teammate.
- Everything runs locally—FastAPI on `:3001`, Pipecat on `:8080/8081`, extension messaging through `chrome.runtime`—so the whole demo spins up on a laptop, no mystery cloud bits required.
- Inline questions, contextual code explain, and screenshot-backed error fixes now keep the flow going even when a developer is heads-down in the editor.

## How we used Gemini models and Pipecat
- Gemini 2.5 Flash (through `google.genai) drives `/analyze`. We wire in a `url_context` call plus up to 50 page links, so answers come back citation-rich and aligned with whatever docs you’re browsing.
- Gemini 2.5 Flash Lite lives inside Pipecat (`GoogleLLMService`). It calls our `analyze_documentation(question)` tool whenever it needs deeper context, keeping conversations grounded while still feeling snappy.
- Pipecat—also a sponsor—runs the full media relay: SmartTurn + Silero VAD tame audio, Deepgram captures transcripts, Gemini replies, Cartesia converts to speech, Tavus streams the face, and RTVI keeps the WebRTC handshake buttery smooth.
- Tavus (sponsor love!) provides the live replica that makes every Gemini answer feel personal. Pipecat hands over Cartesia’s audio so Tavus matches lip sync in real time.
- The same stack powers on-demand code explain and inline follow-ups, letting Gemini step through a highlighted snippet while Pipecat keeps answers grounded in the page DOM.

## Other tools we used
- Deepgram realtime STT (`DeepgramSTTService`, 16 kHz input) so we still get clean transcripts even when someone’s demoing from a noisy expo floor.
- Cartesia TTS (voice `a167e0f3-df7e-4d52-a9c3-f949145efdab`) for a natural tone that lines up perfectly with Tavus’ lip sync.
- Tavus live replica API for the high-quality WebRTC video, plus a `/speak` endpoint we can trigger from text-only flows when needed.
- FastAPI + Uvicorn with CORS for the backend, and aiohttp inside Pipecat so all the cross-service calls stay async and happy.
- Chrome Extension APIs (sidepanel, background messaging) to capture DOM snapshots, map the link graph, and feed that context into Pipecat via `/page-context`.
- Chrome capture APIs bundle inline error screenshots so Gemini can reason about visual failures during fix-up flows.

## What we built during the hackathon
- Spun up a brand-new Chrome side panel (`sidepanel.html/js`) that maps the DOM, spots useful links, and streams the whole package to our backend.
- Crafted the FastAPI `/analyze` endpoint around Gemini 2.5 Flash with tool config, citation harvesting, and extra logging so judges and dev tool teams can see exactly what’s happening.
- Modified the Pipecat quickstart to plug in Gemini Lite function-calling plus our `/page-context` bridge, giving the avatar real awareness of the docs you’re reading.
- Added a `/speak` HTTP endpoint on the Pipecat runner for scripted messages, along with idle timeouts, metrics, and demo-friendly knobs.
- Layered in code explain mode, inline question threads, and screenshot-assisted error fixing so support flows live alongside the docs.

## Challenges
- Dropping the Pipecat and Tavus SDKs straight into a Chrome extension sounded easy… until cross-origin isolation and media permissions started yelling at us. Our fix: spin up the Pipecat client in an iframe, bridge it with `postMessage`, and keep the extension UX intact.
- Tavus cold starts still add a couple seconds before the avatar appears; after chatting with their cofounder and dev team we adopted their UX tips—blur the panel, surface a loading state, and spin up a custom indicator—so the wait feels intentional instead of broken.

## Future improvements
- Publish team-owned cookbooks, best practices, and doc-specific context so maintainers can tune the co-pilot to each product surface.
- Build a lightweight knowledge base ingestion pipeline that keeps the extension aware of internal runbooks without leaving the browser.
- Experiment with Deepgram fusion models alongside Tavus Sparrow and automatic interruption detection to tighten real-time conversations.

## Feedback on the tools
- Gemini Flash + Flash Lite: crazy-fast first-token times (<800 ms) and the `url_context` tool nails grounded doc answers; would love richer typing in `google.genai` so we can skip some boilerplate checks.
- Pipecat: the RTVI handshake and SmartTurn flow make live media demos feel production-ready; clearer docs or type hints around custom tool registration would be icing on the cake.
- Tavus: replicas look amazing and the async SDK meshes nicely with Pipecat; more granular lighting/expression controls via API would help teams fine-tune their avatar vibe.
- Deepgram: held up even with Chrome background noise during demos; a lightweight web worker sample would make it even easier to adopt in browser extensions.
- Cartesia: love the voice library and tone, but built-in latency telemetry would help us auto-tune buffers when we’re juggling WebRTC.

