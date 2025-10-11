#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.TAVUS_API_KEY;

if (!API_KEY) {
  console.error('TAVUS_API_KEY is not set. Please export it before running this script.');
  process.exit(1);
}

const CONFIG_PATH = path.join(__dirname, '..', 'tavus-config.json');

const config = {
  apiKey: API_KEY,
  avatarId: 'avatar_demo_riya',
  prompt: 'How do you debug an API error?',
  context: 'Provide a concise debugging walkthrough for API failures, touching on logs, request validation, and status monitoring.',
  pollingIntervalMs: 3000,
  pollingAttempts: 15,
  fallbackVideoUrl: 'https://storage.googleapis.com/tavus-public-assets/demos/riya-debugging.mp4',
  fallbackPosterUrl: 'https://storage.googleapis.com/tavus-public-assets/demos/riya-poster.jpg'
};

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

console.log(`Tavus configuration written to ${CONFIG_PATH}`);

