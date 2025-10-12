# YC Hack - Documentation Assistant

A Chrome extension that helps you navigate documentation efficiently using AI with an interactive avatar powered by Pipecat and Tavus.

## Features

- 🤖 **AI Avatar Assistant**: Talk naturally with an AI-powered video avatar
- 📚 **Smart Documentation Analysis**: Automatically extracts and analyzes documentation
- 💬 **Voice & Text Interaction**: Speak or type your questions
- 🎥 **Real-time Video**: See and interact with the AI avatar using WebRTC
- 🔊 **Natural Speech**: High-quality text-to-speech with Cartesia

## Prerequisites

- Python 3.11 or higher
- Google Chrome browser
- API keys for:
  - Google Gemini
  - Deepgram (for speech-to-text)
  - Cartesia (for text-to-speech)
  - Tavus (for video avatar)

## Setup Instructions

### Step 1: Set Up Environment Variables

1. Create a `.env` file in the `pipecat-tavus-hackathon` directory:
   ```bash
   cd pipecat-tavus-hackathon
   touch .env
   ```

2. Add your API keys to the `.env` file:
   ```bash
   # Google Gemini API key (get from https://aistudio.google.com/app/apikey)
   GOOGLE_API_KEY=your_gemini_api_key

   # Deepgram API key (get from https://console.deepgram.com/)
   DEEPGRAM_API_KEY=your_deepgram_api_key

   # Cartesia API key (get from https://cartesia.ai/)
   CARTESIA_API_KEY=your_cartesia_api_key

   # Tavus API key (get from https://tavus.io/)
   TAVUS_API_KEY=your_tavus_api_key
   TAVUS_REPLICA_ID=your_replica_id
   ```

3. Also create a `.env` file in the project root for the documentation analysis backend:
   ```bash
   cd ..
   touch .env
   ```

4. Add your Gemini API key to the root `.env` file:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   ```

### Step 2: Install Dependencies

1. **Install Python dependencies (documentation backend):**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Node.js dependencies (Chrome extension):**
   ```bash
   npm install
   ```

3. No build step needed for the extension (avatar client is served via iframe/CDN)

### Step 3: Start the Backend Services

1. **Start the documentation analysis server:**
   ```bash
   python server.py
   ```
   This runs on `http://localhost:3001`

2. **In a new terminal, start the Pipecat avatar server:**
   ```bash
   cd pipecat-tavus-hackathon
   uv run python tavus-pipecat.py --transport webrtc --host localhost --port 8080
   ```
   This runs on `http://localhost:8080` (WebRTC) and `http://localhost:8081` (/speak endpoint)

### Step 4: Load the Chrome Extension

1. **Open Chrome** and go to:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode** by clicking the toggle in the top right corner

3. **Click "Load unpacked"** button

4. **Select this project folder** (`yc-hack`)

5. **Done!** You should see the "YC Hack" extension listed

### Step 5: Grant Permissions

1. **Right-click the YC Hack extension icon** and select **"Options"**
   
   OR go to `chrome://extensions/`, find "YC Hack", and click **"Extension options"**

2. **Click "Grant Camera & Microphone Access"** in the options page

3. **Allow** when Chrome prompts for camera and microphone permissions

4. ✅ You should see both permissions show as "Granted"

### Step 6: Use the Extension

1. Click the **YC Hack** extension icon in your Chrome toolbar
2. The side panel will open on the right
3. Navigate to any documentation site
4. Click **"Analyze Current Page"** to extract documentation
5. Ask questions using text or click **"Connect"** to start a video conversation with the avatar
6. Use the **"🔊 Have Avatar Speak This Answer"** button to have the avatar read responses aloud

## Troubleshooting

### Permission Issues
- **Camera/Microphone not working:** 
  1. Go to extension options (right-click extension icon → Options)
  2. Grant permissions again
  3. Check Chrome settings: `chrome://settings/content/camera` and `chrome://settings/content/microphone`
  4. Make sure the extension has permission to access media

- **"Avatar client not ready" error:** 
  - Make sure you clicked "Connect" before trying to send text to the avatar
  - Check that the Pipecat backend is running on port 8080

### Backend Issues
- **"Connection refused" error:** 
  - Make sure both backend servers are running:
    - Documentation backend on port 3001: `python server.py`
    - Pipecat backend on port 8080: `cd pipecat-tavus-hackathon && uv run python tavus-pipecat.py --transport webrtc --host localhost --port 8080`

- **"API key invalid" error:** 
  - Check that your `.env` files have the correct API keys
  - Make sure there are no quotes around the keys
  - Verify keys are active in their respective dashboards

- **Port already in use:**
  - Kill existing processes: `pkill -f tavus-pipecat.py` or `pkill -f server.py`
  - Or use different ports

### Extension Issues
- **Extension not showing:** 
  - Make sure you enabled Developer Mode in `chrome://extensions/`
  - Try reloading the extension
  - Check for errors in the extension's console

- **Bundle errors:**
  - Rebuild the bundle: `npm run build:avatar`
  - Make sure `node_modules` is installed: `npm install`

## Project Structure

```
yc-hack/
├── server.py                          # Documentation analysis backend (port 3001)
├── manifest.json                      # Chrome extension manifest
├── sidepanel.html                     # Extension side panel UI
├── sidepanel.js                       # Extension logic for page analysis
├── background.js                      # Extension background script
├── options.html                       # Extension options page (permissions)
├── options.js                         # Options page logic
├── avatar-client.js                   # Pipecat WebRTC client wrapper
├── package.json                       # Node.js dependencies
├── requirements.txt                   # Python dependencies (root)
├── .env                              # Environment variables (you create this)
├── dist/
│   └── avatar.bundle.js              # Bundled avatar client
└── pipecat-tavus-hackathon/
    ├── tavus-pipecat.py              # Pipecat bot server (port 8080/8081)
    ├── requirements.txt              # Pipecat Python dependencies
    └── .env                          # Pipecat environment variables
```

## How It Works

1. **Documentation Analysis**: The Chrome extension extracts content from the current page and sends it to the Python backend (`server.py`) which uses Gemini to analyze and answer questions.

2. **Avatar Interaction**: When you click "Connect", the extension establishes a WebRTC connection to the Pipecat server, which orchestrates:
   - **Deepgram** for speech-to-text (your voice → text)
   - **Google Gemini** for LLM responses (text → text)
   - **Cartesia** for text-to-speech (text → audio)
   - **Tavus** for video generation (audio → video avatar)

3. **Permissions**: The options page requests camera/microphone permissions once, which are then available throughout the extension without iframe restrictions.

## API Key Resources

- **Google Gemini**: https://aistudio.google.com/app/apikey
- **Deepgram**: https://console.deepgram.com/
- **Cartesia**: https://cartesia.ai/
- **Tavus**: https://tavus.io/

