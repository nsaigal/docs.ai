document.addEventListener('DOMContentLoaded', function() {
  const domainDisplay = document.getElementById('domain-display');
  const queryInput = document.getElementById('query-input');
  const submitButton = document.getElementById('submit-button');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const citationsContainer = document.getElementById('citations-container');
  
  let currentDomain = '';
  let currentURL = '';
  let currentTabId = null;
  
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
});