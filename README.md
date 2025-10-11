# YC Hack - Documentation Assistant

A Chrome extension that helps you navigate documentation efficiently using AI.

## Prerequisites

- Python 3.8 or higher
- Google Chrome browser
- A Gemini API key (see below)

## Setup Instructions

### Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API key"** or **"Create API key"**
4. Copy the API key (it will look like: `AIza...`)

### Step 2: Set Up the Backend

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create a `.env` file** in the project root:
   ```bash
   touch .env
   ```

3. **Add your Gemini API key** to the `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   Replace `your_api_key_here` with the API key you got from Step 1.

4. **Start the backend server:**
   ```bash
   python server.py
   ```
   
   The server will start on `http://localhost:3001`
   
   ✅ You should see: `INFO:     Uvicorn running on http://0.0.0.0:3001`

### Step 3: Load the Chrome Extension

1. **Open Chrome** and go to:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode** by clicking the toggle in the top right corner

3. **Click "Load unpacked"** button

4. **Select this project folder** (`yc-hack`)

5. **Done!** You should see the "YC Hack" extension listed

### Step 4: Use the Extension

1. Click the **YC Hack** extension icon in your Chrome toolbar
2. The side panel will open on the right
3. Navigate to any documentation site
4. Ask questions about the docs in the side panel!

## Troubleshooting

- **"Connection refused" error:** Make sure the backend server is running (Step 2.4)
- **"API key invalid" error:** Check that your `.env` file has the correct Gemini API key
- **Extension not showing:** Make sure you enabled Developer Mode in Chrome extensions

## Project Structure

```
yc-hack/
├── server.py         # Backend API server
├── manifest.json     # Chrome extension manifest
├── sidepanel.html    # Extension UI
├── sidepanel.js      # Extension logic
├── background.js     # Extension background script
├── requirements.txt  # Python dependencies
└── .env             # Environment variables (you create this)
```

