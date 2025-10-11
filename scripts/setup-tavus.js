#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

function hydrateEnvFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) {
      return;
    }
    const idx = line.indexOf('=');
    if (idx === -1) {
      return;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

if (fs.existsSync(envPath)) {
    try {
        hydrateEnvFromFile(envPath);
    } catch (error) {
        console.warn(`Unable to parse .env file at ${envPath}:`, error.message);
    }
}

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

