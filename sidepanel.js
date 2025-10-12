document.addEventListener('DOMContentLoaded', function() {
  const domainDisplay = document.getElementById('domain-display');
  const queryInput = document.getElementById('query-input');
  const submitButton = document.getElementById('submit-button');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const citationsContainer = document.getElementById('citations-container');
  const escalateBtn = document.getElementById('escalate-button');
  const avatarSection = document.getElementById('avatar-section');
  const themeToggle = document.getElementById('theme-toggle');
  
  let currentDomain = '';
  let currentURL = '';
  let currentTabId = null;
  
  // Theme toggle functionality
  function setTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  }
  
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  
  // Toggle theme on switch click
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
      setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
  }
  
  // Handle escalate button click to show/hide avatar
  if (escalateBtn && avatarSection) {
    escalateBtn.addEventListener('click', function() {
      const isVisible = avatarSection.classList.contains('show');
      if (isVisible) {
        avatarSection.classList.remove('show');
        escalateBtn.classList.remove('active');
        escalateBtn.textContent = 'Escalate';
      } else {
        avatarSection.classList.add('show');
        escalateBtn.classList.add('active');
        escalateBtn.textContent = '✓ Close Avatar';
      }
    });
  }
  
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

  let sidePanelPort = null;
  let portDisconnected = false;

  function connectPort() {
    if (!chrome.runtime?.connect) {
      return null;
    }

    try {
      const port = chrome.runtime.connect({ name: 'YCH_SIDE_PANEL' });
      portDisconnected = false;

      port.onMessage.addListener((message) => {
        if (message?.type === 'CODE_EXPLAIN_REQUEST') {
          handleExplainRequest(message.tabId, message.payload);
        }
      });

      port.onDisconnect.addListener(() => {
        console.log('Port disconnected');
        portDisconnected = true;
        sidePanelPort = null;
      });

      return port;
    } catch (e) {
      console.error('Failed to connect port:', e);
      return null;
    }
  }

  sidePanelPort = connectPort();

  function requestLatestExplain(tabId) {
    if (typeof tabId !== 'number') {
      return;
    }

    // Reconnect if port is disconnected
    if (!sidePanelPort || portDisconnected) {
      console.log('Reconnecting port...');
      sidePanelPort = connectPort();
    }

    if (!sidePanelPort) {
      console.warn('Cannot request explain: port unavailable');
      return;
    }

    try {
      sidePanelPort.postMessage({
        type: 'CODE_EXPLAIN_CONSUME',
        tabId
      });
    } catch (e) {
      console.error('Failed to send message through port:', e);
      portDisconnected = true;
      sidePanelPort = null;
    }
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

    console.log('Handling explain request for code snippet');

    // Show the answer section
    if (answerSection) {
      answerSection.classList.add('show');
    }
    
    // Clear any previous mode
    setAnswerMode(null);

    // Update header to show this is a code explanation
    const header = answerSection?.querySelector('.answer-header');
    if (header) {
      header.textContent = '🧠 Code Explanation';
    }

    // Show loading state
    answerText.innerHTML = '<div class="loading-text">🔍 Analyzing code snippet...</div>';
    citationsContainer.innerHTML = '';

    try {
      console.log('Sending explain request to server...');
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
        throw new Error('Explain request failed with status: ' + response.status);
      }

      const data = await response.json();
      console.log('Received explanation from server');
      
      // Render the markdown explanation
      if (data.result) {
        answerText.innerHTML = renderMarkdown(data.result);
      } else {
        answerText.innerHTML = '<div class="error-text">No explanation received from server.</div>';
      }
    } catch (error) {
      console.error('Explain request failed:', error);
      answerText.innerHTML = '<div class="error-text">❌ Unable to explain code: ' + error.message + '</div>';
    }
  }

  // Get the current active tab and extract its domain
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs.length > 0) {
      currentTabId = tabs[0].id;
      currentURL = tabs[0].url;
      
      try {
        const urlObj = new URL(currentURL);
        currentDomain = urlObj.hostname;
        domainDisplay.textContent = currentDomain;
      } catch (err) {
        domainDisplay.textContent = 'Unable to extract domain';
      }
    } else {
      domainDisplay.textContent = 'No active tab found';
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
          // Remove trailing punctuation from URLs
          citationsToDisplay = foundUrls.map((url, idx) => {
            const cleanUrl = url.replace(/[.,;:!?]+$/, '');
            return {
              index: idx,
              title: cleanUrl,
              url: cleanUrl
            };
          });
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

  // Avatar integration
  const iframe = document.getElementById('avatar-iframe');
  const speakAnswerBtn = document.getElementById('speak-answer-btn');
  const muteBtn = document.getElementById('avatar-mute-btn');
  const sharePageBtn = document.getElementById('share-page-btn');
  let isMuted = false;
  let lastSharedContext = null;
  
  // Send answer to avatar
  if (speakAnswerBtn && answerText && iframe) {
    speakAnswerBtn.addEventListener('click', function(){
      const text = (answerText.innerText || '').trim();
      if (!text) return;
      try {
        iframe.contentWindow.postMessage({ type: 'speak', text }, 'http://localhost:8080');
      } catch (e) { 
        console.error('Error sending to avatar:', e);
      }
    });
  }

  // Mute/unmute microphone in iframe (avatar client)
  if (muteBtn && iframe) {
    muteBtn.addEventListener('click', function(){
      isMuted = !isMuted;
      try {
        iframe.contentWindow.postMessage({ type: 'toggle-mic', mute: isMuted }, 'http://localhost:8080');
        muteBtn.textContent = isMuted ? 'Unmute Mic' : 'Mute Mic';
      } catch (e) {
        console.error('Error toggling mic:', e);
      }
    });
  }

  // Share page context with avatar
  if (sharePageBtn) {
    sharePageBtn.addEventListener('click', async function(){
      if (sharePageBtn.dataset.sending === 'true') return;
      console.log('Share page button clicked');
      sharePageBtn.dataset.sending = 'true';
      const originalText = sharePageBtn.textContent;
      sharePageBtn.textContent = 'Sharing...';
      sharePageBtn.disabled = true;
      sharePageBtn.style.opacity = '0.7';
      const shared = await sendCurrentPageContext(true);
      if (shared) {
        sharePageBtn.textContent = 'Shared!';
        sharePageBtn.style.background = 'rgba(0, 255, 159, 0.3)';
        sharePageBtn.style.borderColor = '#00ff9f';
        setTimeout(() => {
          sharePageBtn.textContent = originalText;
          sharePageBtn.style.background = 'rgba(255, 0, 255, 0.2)';
          sharePageBtn.style.borderColor = '#ff00ff';
        }, 2000);
      } else {
        sharePageBtn.textContent = 'Retry Share';
      }
      sharePageBtn.disabled = false;
      sharePageBtn.style.opacity = '1';
      sharePageBtn.dataset.sending = 'false';
    });
  }
  
  // Send current page context (URL, domain, links) to iframe and backend
  async function sendCurrentPageContext(force = false) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
        if (!tabs[0]) {
          resolve(false);
          return;
        }
        const url = tabs[0].url;
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              const domain = window.location.hostname;
              const links = Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({ text: a.textContent.trim().substring(0, 100), url: a.href }))
                .filter(link => link.text && link.url);
              return { domain, links };
            }
          });
          if (results && results[0] && results[0].result) {
            const { domain, links } = results[0].result;
            const payload = { url, domain, links };

            const hasChanges = !lastSharedContext || force ||
              lastSharedContext.url !== payload.url ||
              lastSharedContext.domain !== payload.domain ||
              (lastSharedContext.links || []).length !== payload.links.length;

            if (!hasChanges) {
              console.log('Page context unchanged, skipping share');
              resolve(true);
              return;
            }

            let iframePosted = false;
            try {
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ 
                  type: 'page-context', 
                  url: payload.url, 
                  domain: payload.domain, 
                  links: payload.links 
                }, 'http://localhost:8080');
                iframePosted = true;
                console.log('Sent page context to iframe:', { url: payload.url, domain: payload.domain, linksCount: payload.links.length });
              }
            } catch (e) {
              console.error('Error sending page context to iframe:', e);
            }

            let backendPosted = false;
            try {
              const response = await fetch('http://localhost:8081/page-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (!response.ok) {
                throw new Error('Backend responded with status ' + response.status);
              }
              backendPosted = true;
              console.log('Sent page context to backend:', { url: payload.url, domain: payload.domain, linksCount: payload.links.length });
            } catch (e) {
              console.error('Error sending page context to backend:', e);
            }

            if (iframePosted || backendPosted) {
              lastSharedContext = payload;
              resolve(true);
              return;
            }
          }
        } catch (e) {
          console.error('Error getting page context:', e);
        }
        resolve(false);
      });
    });
  }

  // Listen for status updates from iframe
  window.addEventListener('message', function(event) {
    if (event.origin !== 'http://localhost:8080') return;
    const data = event.data;
    
    if (data.type === 'avatar-connected') {
      console.log('Avatar connected');
      if (speakAnswerBtn) speakAnswerBtn.style.display = 'block';
    } else if (data.type === 'avatar-disconnected') {
      console.log('Avatar disconnected');
      if (speakAnswerBtn) speakAnswerBtn.style.display = 'none';
    } else if (data.type === 'avatar-error') {
      console.error('Avatar error:', data.error);
    } else if (data.type === 'mic-state') {
      // Sync button label if iframe reports state
      if (typeof data.muted === 'boolean') {
        isMuted = data.muted;
        if (muteBtn) muteBtn.textContent = isMuted ? 'Unmute Mic' : 'Mute Mic';
      }
    }
  });
  
  // Show speak button when answer appears
  const answerObserver = new MutationObserver(function() {
    if (answerText && answerText.innerText.trim() && speakAnswerBtn) {
      speakAnswerBtn.style.display = 'block';
    } else if (speakAnswerBtn) {
      speakAnswerBtn.style.display = 'none';
    }
  });
  if (answerText) {
    answerObserver.observe(answerText, { childList: true, subtree: true });
  }

  // Simple 5-second timer to remove loading overlay
  setTimeout(function() {
    const overlay = document.getElementById('avatar-loading-overlay');
    const placeholder = document.querySelector('.avatar-placeholder');
    
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.backdropFilter = 'blur(0px)';
      setTimeout(function() {
        overlay.style.display = 'none';
      }, 600);
    }
    
    if (placeholder) {
      placeholder.style.transition = 'opacity 0.6s ease-out';
      placeholder.style.opacity = '0';
      setTimeout(function() {
        placeholder.style.display = 'none';
      }, 600);
    }
  }, 5000);
});