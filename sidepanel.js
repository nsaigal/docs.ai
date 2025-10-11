document.addEventListener('DOMContentLoaded', function() {
  const domainDisplay = document.getElementById('domain-display');
  const queryInput = document.getElementById('query-input');
  const submitButton = document.getElementById('submit-button');
  const fixErrorToggle = document.getElementById('fix-error-toggle');
  const fixErrorToggleLabel = document.getElementById('fix-error-toggle-label');
  const errorModeControls = document.getElementById('error-mode-controls');
  const errorInput = document.getElementById('error-input');
  const errorDropzone = document.getElementById('error-dropzone');
  const errorFileInput = document.getElementById('error-file-input');
  const errorAttachment = document.getElementById('error-attachment');
  const errorAttachmentImage = document.getElementById('error-attachment-image');
  const errorAttachmentName = document.getElementById('error-attachment-name');
  const clearErrorAttachmentButton = document.getElementById('clear-error-attachment');
  const fixSummaryEl = document.getElementById('fix-summary');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const citationsContainer = document.getElementById('citations-container');
  const answerHeader = answerSection?.querySelector?.('.answer-header');
  
  const escalateBtn = document.getElementById('escalate');
  const escalationCard = document.getElementById('escalation-card');
  const tavusTranscriptEl = document.getElementById('tavus-transcript');
  const tavusVideoEl = document.getElementById('tavus-video');
  const tavusPromptInput = document.getElementById('tavus-prompt');
  const tavusPlayButton = document.getElementById('tavus-play');
  const themeToggle = document.getElementById('theme-toggle');
  const logoContainer = document.getElementById('logo-container');
  const bodyElement = document.body;

  let currentDomain = '';
  let currentURL = '';
  let currentTabId = null;
  let tavusConfig = null;
  let tavusPolling = null;
  let currentTheme = 'light';
  let isFixErrorMode = false;
  let errorScreenshot = null;
  const MAX_LINKS_TO_SEND = 80;
  const DOC_CONTEXT_MAX_CHARS = 4000;

  const storageAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const sidePanelPort = chrome.runtime?.connect ? chrome.runtime.connect({ name: 'YCH_SIDE_PANEL' }) : null;

  sidePanelPort?.onMessage.addListener((message) => {
    if (message?.type === 'CODE_EXPLAIN_REQUEST') {
      handleExplainRequest(message.tabId, message.payload);
    }
  });

  function requestLatestExplain(tabId) {
    if (!sidePanelPort || typeof tabId !== 'number') {
      return;
    }

    sidePanelPort.postMessage({
      type: 'CODE_EXPLAIN_CONSUME',
      tabId
    });
  }

  chrome.runtime?.onMessage?.addListener?.((message) => {
    if (message?.type === 'CODE_EXPLAIN_READY' && typeof message.tabId === 'number') {
      requestLatestExplain(message.tabId);
    }
  });

  function setAnswerMode(mode) {
    if (!answerSection) {
      return;
    }

    if (mode) {
      answerSection.dataset.mode = mode;
    } else {
      answerSection.removeAttribute('data-mode');
    }
  }

  async function handleExplainRequest(tabId, payload) {
    if (!payload) {
      return;
    }

    if (answerSection) {
      answerSection.classList.add('show');
    }
    setAnswerMode('code');

    const header = answerSection?.querySelector('.answer-header');
    if (header) {
      header.textContent = 'Explain Code';
    }

    answerText.innerHTML = '<div class="loading-text">Explaining code snippet...</div>';
    citationsContainer.innerHTML = '';

    try {
      const response = await fetch('http://localhost:3001/explain-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: payload.code,
          language: payload.language,
          url: payload.url,
          title: payload.title
        })
      });

      if (!response.ok) {
        throw new Error('Explain request failed: ' + response.status);
      }

      const data = await response.json();
      answerText.innerHTML = renderMarkdown(data.result || '');
    } catch (error) {
      console.error('Explain request failed', error);
      answerText.innerHTML = '<div class="error-text">Unable to explain the code snippet right now.</div>';
    }
  }

  function persistTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    if (storageAvailable) {
      chrome.storage.local.set({ uiTheme: normalizedTheme }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          try {
            localStorage.setItem('uiTheme', normalizedTheme);
          } catch (err) {
            console.warn('Unable to persist theme preference', err);
          }
        }
      });
    } else {
      try {
        localStorage.setItem('uiTheme', normalizedTheme);
      } catch (err) {
        console.warn('Unable to persist theme preference', err);
      }
    }
  }

  function loadThemePreference() {
    return new Promise((resolve) => {
      const fallback = () => {
        try {
          const stored = localStorage.getItem('uiTheme');
          resolve(mapStoredTheme(stored));
        } catch (err) {
          resolve('light');
        }
      };

      if (!storageAvailable) {
        fallback();
        return;
      }

      try {
        chrome.storage.local.get(['uiTheme'], (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            fallback();
          } else {
            resolve(mapStoredTheme(result.uiTheme));
          }
        });
      } catch (err) {
        console.warn('Unable to load theme preference', err);
        fallback();
      }
    });
  }

  function mapStoredTheme(stored) {
    if (stored === 'dark' || stored === 'neon') {
      return 'dark';
    }
    if (stored === 'light' || stored === 'classic') {
      return 'light';
    }
    return stored ? stored : 'light';
  }

  function applyTheme(theme) {
    const normalizedTheme = mapStoredTheme(theme);
    const useDarkMode = normalizedTheme === 'dark';
    currentTheme = useDarkMode ? 'dark' : 'light';

    bodyElement.classList.toggle('dark-mode', useDarkMode);
    if (logoContainer) {
      logoContainer.classList.toggle('active', useDarkMode);
      logoContainer.setAttribute('aria-hidden', String(!useDarkMode));
    }

    if (themeToggle) {
      themeToggle.classList.toggle('is-dark', useDarkMode);
      themeToggle.setAttribute('aria-pressed', String(useDarkMode));
      themeToggle.setAttribute(
        'aria-label',
        useDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  async function initializeTheme() {
    const savedTheme = await loadThemePreference();
    applyTheme(savedTheme);
  }

  themeToggle?.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  });

  function clearErrorAttachment() {
    errorScreenshot = null;
    if (errorAttachment) {
      errorAttachment.hidden = true;
      errorAttachment.classList.remove('show');
    }
    if (errorAttachmentImage) {
      errorAttachmentImage.src = '';
    }
    if (errorAttachmentName) {
      errorAttachmentName.textContent = '';
    }
  }

  function updateFixErrorUI() {
    if (!fixErrorToggle) {
      return;
    }

    fixErrorToggle.classList.toggle('is-active', isFixErrorMode);
    fixErrorToggle.setAttribute('aria-pressed', String(isFixErrorMode));

    if (fixErrorToggleLabel) {
      fixErrorToggleLabel.textContent = isFixErrorMode ? 'Fix Error Mode On' : 'Fix Error Mode';
    }

    if (errorModeControls) {
      if (isFixErrorMode) {
        errorModeControls.classList.add('show');
        errorModeControls.hidden = false;
      } else {
        errorModeControls.classList.remove('show');
        errorModeControls.hidden = true;
        if (errorInput) {
          errorInput.value = '';
        }
        clearErrorAttachment();
      }
    }

    if (!isFixErrorMode && fixSummaryEl) {
      fixSummaryEl.hidden = true;
      fixSummaryEl.classList.remove('show');
      fixSummaryEl.innerHTML = '';
    }
  }

  fixErrorToggle?.addEventListener('click', () => {
    isFixErrorMode = !isFixErrorMode;
    updateFixErrorUI();
  });

  clearErrorAttachmentButton?.addEventListener('click', (event) => {
    event.preventDefault();
    clearErrorAttachment();
  });

  function validateScreenshot(file) {
    if (!file) {
      return 'No file selected.';
    }

    if (!file.type.startsWith('image/')) {
      return 'Only image files are supported.';
    }

    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      return 'Screenshot must be under 6 MB.';
    }

    return null;
  }

  async function readFileAsBase64(file) {
    const validationError = validateScreenshot(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      errorScreenshot = {
        name: file.name,
        mimeType: file.type,
        data: base64,
      };

      if (errorAttachment && errorAttachmentImage && errorAttachmentName) {
        errorAttachment.hidden = false;
        errorAttachment.classList.add('show');
        errorAttachmentImage.src = `data:${file.type};base64,${base64}`;
        errorAttachmentName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      }
    } catch (error) {
      console.error('Failed to read screenshot', error);
      alert('Unable to load screenshot. Try a different file.');
    }
  }

  errorFileInput?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    if (file) {
      readFileAsBase64(file);
      event.target.value = '';
    }
  });

  if (errorDropzone) {
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((name) => {
      errorDropzone.addEventListener(name, stop);
    });

    errorDropzone.addEventListener('dragover', () => {
      errorDropzone.classList.add('dragover');
    });

    errorDropzone.addEventListener('dragleave', () => {
      errorDropzone.classList.remove('dragover');
    });

    errorDropzone.addEventListener('drop', (event) => {
      errorDropzone.classList.remove('dragover');
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        readFileAsBase64(file);
      }
    });

    errorDropzone.addEventListener('click', () => {
      errorFileInput?.click();
    });
  }

  document.addEventListener('paste', (event) => {
    if (!isFixErrorMode) {
      return;
    }

    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          readFileAsBase64(file);
          break;
        }
      }
    }
  });
  
  // Simple markdown renderer
  function renderMarkdown(text) {
    return text
      // Headers
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks (must be before inline code)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Unordered lists
      .replace(/^\* (.+)$/gim, '<li>$1</li>')
      .replace(/^- (.+)$/gim, '<li>$1</li>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gim, '<li>$1</li>')
      // Wrap list items in ul/ol tags
      .replace(/(<li>.*?<\/li>)/gs, function(match) {
        return '<ul>' + match + '</ul>';
      })
      // Clean up nested lists
      .replace(/<\/ul>\s*<ul>/g, '')
      // Blockquotes
      .replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>')
      // Line breaks and paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Wrap in paragraphs if not already in a block element
      .split('\n')
      .map(line => {
        if (!line.match(/^<(h[1-6]|ul|ol|li|pre|blockquote)/)) {
          return line.trim() ? '<p>' + line + '</p>' : line;
        }
        return line;
      })
      .join('\n')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<h[1-6]>)/g, '$1')
      .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
      .replace(/<p>(<ul>)/g, '$1')
      .replace(/(<\/ul>)<\/p>/g, '$1')
      .replace(/<p>(<pre>)/g, '$1')
      .replace(/(<\/pre>)<\/p>/g, '$1')
      .replace(/<p>(<blockquote>)/g, '$1')
      .replace(/(<\/blockquote>)<\/p>/g, '$1');
  }

  function updateDomainFromTab(tab) {
    if (!tab) {
      domainDisplay.textContent = 'No active tab found';
      return;
    }

    currentTabId = tab.id;
    currentURL = tab.url;

    if (!currentURL) {
      domainDisplay.textContent = 'Unable to extract domain';
      return;
    }

    try {
      const urlObj = new URL(currentURL);
      currentDomain = urlObj.hostname;
      domainDisplay.textContent = currentDomain;
    } catch (err) {
      domainDisplay.textContent = 'Unable to extract domain';
    }
  }

  function refreshActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.warn('Unable to query tabs', chrome.runtime.lastError);
        return;
      }

      if (tabs && tabs.length > 0) {
        updateDomainFromTab(tabs[0]);
      } else {
        domainDisplay.textContent = 'No active tab found';
      }
    });
  }

  refreshActiveTab();

  chrome.tabs.onActivated.addListener(() => {
    refreshActiveTab();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete' && tab.url) {
      updateDomainFromTab(tab);
    }
  });

  initializeTheme();

  chrome.tabs.onActivated.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs.length) {
        domainDisplay.textContent = 'No active tab found';
        return;
      }
      try {
        const urlObj = new URL(tabs[0].url || '');
        currentDomain = urlObj.hostname;
        domainDisplay.textContent = currentDomain;
      } catch (err) {
        domainDisplay.textContent = 'Unable to extract domain';
      }
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete' && tab.url) {
      try {
        const urlObj = new URL(tab.url);
        currentDomain = urlObj.hostname;
        domainDisplay.textContent = currentDomain;
      } catch (err) {
        domainDisplay.textContent = 'Unable to extract domain';
      }
    }
  });

  // Handle form submission
  submitButton.addEventListener('click', async () => {
    const query = queryInput.value.trim();
    const errorText = errorInput?.value?.trim() || '';

    if (!isFixErrorMode && !query) {
      alert('Please enter a query');
      return;
    }

    if (isFixErrorMode && !query && !errorText && !errorScreenshot) {
      alert('Add the error text, a screenshot, or both before submitting.');
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        currentTabId = tabs[0].id;
        currentURL = tabs[0].url;
        const urlObj = new URL(currentURL);
        currentDomain = urlObj.hostname;
        domainDisplay.textContent = currentDomain;
      }
    } catch (err) {
      console.error('Error updating domain:', err);
    }

    if (!currentDomain) {
      alert('Domain not available');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Thinking...';
    answerSection.classList.add('show');
    answerText.innerHTML = '<div class="loading-text">Searching and analyzing...</div>';
    citationsContainer.innerHTML = '';
    if (fixSummaryEl) {
      fixSummaryEl.hidden = true;
      fixSummaryEl.classList.remove('show');
      fixSummaryEl.innerHTML = '';
    }

    if (isFixErrorMode) {
      setAnswerMode('error');
      if (answerHeader) {
        answerHeader.textContent = 'Fix Error';
      }
    } else {
      setAnswerMode(null);
      if (answerHeader) {
        answerHeader.textContent = 'Answer';
      }
    }

    const pageContext = await gatherPageContext();
    const requestPayload = buildRequestPayload({ query, errorText, pageContext });

    try {
      const response = await fetch(requestPayload.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload.body)
      });

      if (!response.ok) {
        throw new Error('Request failed: ' + response.status);
      }

      const data = await response.json();
      handleAssistantResponse(data, pageContext);
    } catch (error) {
      console.error('Assistant error:', error);
      answerText.innerHTML = '<div class="error-text">Error: ' + error.message + '</div>';
      citationsContainer.innerHTML = '';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Ask';
    }
  });
  
  // Allow Enter key to submit
  queryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });

  // Tavus escalation logic
  async function loadTavusConfig() {
    if (tavusConfig) {
      return tavusConfig;
    }

    try {
      const response = await fetch(chrome.runtime.getURL('tavus-config.json'));
      if (!response.ok) {
        throw new Error('Missing Tavus config. Run scripts/setup-tavus.js');
      }
      tavusConfig = await response.json();
      return tavusConfig;
    } catch (error) {
      console.error('Failed to load Tavus config', error);
      tavusTranscriptEl.textContent = 'Tavus configuration missing. Please run setup.';
      return null;
    }
  }

  escalateBtn?.addEventListener('click', async () => {
    if (!escalationCard || !tavusTranscriptEl || !tavusVideoEl) {
      console.warn('Tavus UI elements missing.');
      return;
    }

    escalationCard.classList.add('visible');
    escalationCard.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (tavusVideoEl?.paused) {
      tavusVideoEl.muted = true;
      tavusVideoEl.play().catch(() => {});
    }

    if (!tavusTranscriptEl.dataset.loaded) {
      await fetchTavusResponse();
    }
  });

  async function fetchTavusResponse(customPrompt) {
    if (!tavusTranscriptEl || !tavusVideoEl) {
      return;
    }

    const config = await loadTavusConfig();
    if (!config) {
      tavusTranscriptEl.textContent = 'Tavus setup incomplete.';
      return;
    }

    const { apiKey, avatarId, prompt, context, pollingIntervalMs = 3000, pollingAttempts = 15 } = config;

    if (!apiKey || !avatarId) {
      tavusTranscriptEl.textContent = 'Tavus API key or avatar ID missing in config.';
      return;
    }

    try {
      tavusTranscriptEl.textContent = 'Connecting to Tavus...';

      const response = await fetch('https://api.tavus.io/v2/avatars/speeches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          avatar_id: avatarId,
          script: {
            type: 'text',
            input_text: customPrompt || prompt,
            context,
          },
          voice: 'default',
          subtitles: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavus API error: ${response.status}`);
      }

      const { speech_id } = await response.json();
      tavusTranscriptEl.textContent = 'Avatar is preparing a response...';

      await pollSpeechStatus(speech_id, pollingIntervalMs, pollingAttempts);
    } catch (error) {
      console.error('Failed to load Tavus response', error);
      tavusTranscriptEl.textContent = 'Unable to load Tavus response. Please try again later.';
    }
  }

  async function pollSpeechStatus(speechId, intervalMs, attempts) {
    if (!tavusTranscriptEl || !tavusVideoEl) {
      return;
    }

    const config = await loadTavusConfig();
    if (!config) return;

    const { apiKey, fallbackVideoUrl, fallbackPosterUrl } = config;

    let attempt = 0;
    clearInterval(tavusPolling);

    tavusPolling = setInterval(async () => {
      attempt += 1;

      if (attempt > attempts) {
        clearInterval(tavusPolling);
        tavusTranscriptEl.textContent = 'Tavus response timed out. Showing fallback video.';
        setFallbackVideo();
        return;
      }

      try {
        const response = await fetch(`https://api.tavus.io/v2/avatars/speeches/${speechId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Tavus polling error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'completed') {
          clearInterval(tavusPolling);

          const transcript = data.transcription || data.script?.input_text || 'No transcript available.';
          const videoUrl = data.assets?.video_url;

          tavusTranscriptEl.textContent = transcript;
          tavusTranscriptEl.dataset.loaded = 'true';

          if (videoUrl) {
            tavusVideoEl.src = videoUrl;
            tavusVideoEl.poster = data.assets?.poster_image || fallbackPosterUrl;
            tavusVideoEl.muted = false;
            tavusVideoEl.play().catch((error) => {
              console.warn('Autoplay blocked, keeping video muted.', error);
              tavusVideoEl.muted = true;
            });
          } else {
            setFallbackVideo();
          }
        } else if (data.status === 'failed') {
          clearInterval(tavusPolling);
          tavusTranscriptEl.textContent = 'Tavus speech failed. Showing fallback video.';
          setFallbackVideo();
        }
      } catch (error) {
        console.error('Error polling Tavus speech', error);
      }
    }, intervalMs);
  }

  async function setFallbackVideo() {
    if (!tavusVideoEl) {
      return;
    }

    const config = await loadTavusConfig();
    if (!config) return;

    const { fallbackVideoUrl, fallbackPosterUrl } = config;
    if (fallbackVideoUrl) {
      tavusVideoEl.src = fallbackVideoUrl;
    }
    if (fallbackPosterUrl) {
      tavusVideoEl.poster = fallbackPosterUrl;
    }
    tavusVideoEl.muted = true;
    tavusVideoEl.play().catch(() => {});
  }

  tavusPlayButton?.addEventListener('click', async () => {
    if (!tavusPromptInput) {
      console.warn('Prompt input missing.');
      return;
    }

    const message = tavusPromptInput.value.trim();
    if (!message) {
      tavusTranscriptEl.textContent = 'Enter a message for the avatar to speak.';
      tavusPromptInput.focus();
      return;
    }

    tavusPlayButton.disabled = true;
    tavusPlayButton.textContent = 'Generating...';

    try {
      if (tavusVideoEl?.paused) {
        tavusVideoEl.muted = true;
        tavusVideoEl.play().catch(() => {});
      }

      await fetchTavusResponse(message);
    } catch (error) {
      console.error('Failed to trigger Tavus speech', error);
      tavusTranscriptEl.textContent = 'Unable to generate speech. Please try again later.';
    } finally {
      tavusPlayButton.disabled = false;
      tavusPlayButton.textContent = 'Play Avatar Response';
    }
  });
});