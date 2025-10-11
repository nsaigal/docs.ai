document.addEventListener('DOMContentLoaded', function() {
  const domainDisplay = document.getElementById('domain-display');
  const queryInput = document.getElementById('query-input');
  const submitButton = document.getElementById('submit-button');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const citationsContainer = document.getElementById('citations-container');
  
  const escalateBtn = document.getElementById('escalate');
  const escalationCard = document.getElementById('escalation-card');
  const tavusTranscriptEl = document.getElementById('tavus-transcript');
  const tavusVideoEl = document.getElementById('tavus-video');
  const themeToggle = document.getElementById('theme-toggle');
  const logoContainer = document.getElementById('logo-container');
  const bodyElement = document.body;

  let currentDomain = '';
  let currentURL = '';
  let currentTabId = null;
  let tavusConfig = null;
  let tavusPolling = null;
  let currentTheme = 'classic';

  const storageAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function persistTheme(theme) {
    if (storageAvailable) {
      chrome.storage.local.set({ uiTheme: theme }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          try {
            localStorage.setItem('uiTheme', theme);
          } catch (err) {
            console.warn('Unable to persist theme preference', err);
          }
        }
      });
    } else {
      try {
        localStorage.setItem('uiTheme', theme);
      } catch (err) {
        console.warn('Unable to persist theme preference', err);
      }
    }
  }

  function loadThemePreference() {
    return new Promise((resolve) => {
      const fallback = () => {
        try {
          resolve(localStorage.getItem('uiTheme') || 'classic');
        } catch (err) {
          resolve('classic');
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
            resolve(result.uiTheme || 'classic');
          }
        });
      } catch (err) {
        console.warn('Unable to load theme preference', err);
        fallback();
      }
    });
  }

  function applyTheme(theme) {
    const useDarkMode = theme === 'neon';
    currentTheme = useDarkMode ? 'neon' : 'classic';

    bodyElement.classList.toggle('dark-mode', useDarkMode);
    if (logoContainer) {
      logoContainer.classList.toggle('active', useDarkMode);
      logoContainer.setAttribute('aria-hidden', String(!useDarkMode));
    }

    if (themeToggle) {
      themeToggle.textContent = useDarkMode ? 'Disable Neon UI' : 'Enable Neon UI';
      themeToggle.setAttribute('aria-pressed', String(useDarkMode));
    }
  }

  async function initializeTheme() {
    const savedTheme = await loadThemePreference();
    applyTheme(savedTheme === 'neon' ? 'neon' : 'classic');
  }

  themeToggle?.addEventListener('click', () => {
    const nextTheme = currentTheme === 'neon' ? 'classic' : 'neon';
    applyTheme(nextTheme);
    persistTheme(nextTheme);
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
  submitButton.addEventListener('click', async function() {
    const query = queryInput.value.trim();
    
    if (!query) {
      alert('Please enter a query');
      return;
    }
    
    // Update current URL and domain before submitting
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
    
    // Extract all links from the page
    let pageLinks = [];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => {
          const links = [];
          document.querySelectorAll('a[href]').forEach(link => {
            const href = link.href;
            const text = link.textContent.trim();
            if (href && text) {
              links.push({ text, url: href });
            }
          });
          return links;
        }
      });
      
      if (results && results[0] && results[0].result) {
        pageLinks = results[0].result;
        console.log('Extracted links:', pageLinks.length);
        console.log('Sample links:', pageLinks.slice(0, 3));
    } else {
        console.log('No results from script execution');
      }
    } catch (err) {
      console.error('Error extracting links:', err);
      console.error('Full error:', err);
    }
    
    console.log('Sending request with', pageLinks.length, 'links');
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Thinking...';
    answerSection.classList.add('show');
    answerText.innerHTML = '<div class="loading-text">Searching and analyzing...</div>';
    citationsContainer.innerHTML = '';
    
    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: currentDomain,
          query: query,
          url: currentURL,
          links: pageLinks
        })
      });
      
      if (!response.ok) {
        throw new Error('Request failed: ' + response.status);
      }
      
      const data = await response.json();
      
      console.log('Response data:', data);
      console.log('Citations:', data.citations);
      
      // Display answer with markdown rendering
      answerText.innerHTML = renderMarkdown(data.result);
      
      // Helper function to navigate to a citation URL
      function navigateToCitation(citation) {
        if (!currentTabId || !citation.url) return;
        
        // Use the URL directly - redirect URLs will automatically redirect to the actual page
        const targetUrl = citation.url;
        
        console.log('Navigating to:', targetUrl);
        console.log('Citation title:', citation.title);
        
        chrome.tabs.update(currentTabId, { url: targetUrl }, function() {
          console.log('Navigation complete');
        });
      }
      
      // Extract URLs from response text if no formal citations
      let citationsToDisplay = data.citations || [];
      
      if (citationsToDisplay.length === 0) {
        // Extract URLs from the response text
        const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
        const foundUrls = data.result.match(urlRegex);
        
        if (foundUrls) {
          console.log('Found URLs in response:', foundUrls);
          citationsToDisplay = foundUrls.map((url, idx) => ({
            index: idx,
            title: url,
            url: url
          }));
        }
      }
      
      // Display citations as hyperlinks at the bottom if available
      if (citationsToDisplay.length > 0) {
        citationsContainer.innerHTML = '';
        
        // Automatically navigate to the first citation
        navigateToCitation(citationsToDisplay[0]);
        
        citationsToDisplay.forEach((citation, index) => {
          const link = document.createElement('a');
          link.className = 'citation-link';
          link.href = '#';
          link.textContent = (index + 1).toString();
          link.title = citation.title || citation.url;
          
          // Navigate the current tab to this URL when clicked
          link.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToCitation(citation);
          });
          
          citationsContainer.appendChild(link);
        });
      }
      
    } catch (err) {
      console.error('Error:', err);
      answerText.innerHTML = '<div class="error-text">Error: ' + err.message + '</div>';
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

  async function fetchTavusResponse() {
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
            input_text: prompt,
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
});