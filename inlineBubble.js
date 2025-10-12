const INLINE_BUBBLE_ID = 'yc-inline-answer-bubble-root';
const CODE_ACTIONS_STYLE_ID = 'yc-code-actions-style';
const CODE_ACTION_CONTAINER_CLASS = 'yc-code-action-container';
const CODE_ACTION_BUTTON_CLASS = 'yc-code-action-button';
const CODE_ACTION_BOUND_ATTR = 'data-yc-code-actions-bound';
const CODE_SNIPPET_MAX_LENGTH = 4000;

let shadowHost = null;
let shadowRoot = null;
let activeSelectionText = '';
let activeSelectionRect = null;

// Global handler for uncaught promise rejections from invalidated extension context
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && 
      (event.reason.message?.includes('Extension context invalidated') ||
       event.reason.message?.includes('message port closed') ||
       event.reason.message?.includes('Could not establish connection'))) {
    // Suppress these errors - they're expected when extension is reloaded
    event.preventDefault();
    console.warn('YC Hack Extension: Page needs refresh after extension reload');
  }
});

function ensureCodeActionStyles() {
  if (document.getElementById(CODE_ACTIONS_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = CODE_ACTIONS_STYLE_ID;
  style.textContent = `
    pre[${CODE_ACTION_BOUND_ATTR}] {
      position: relative;
    }

    .${CODE_ACTION_CONTAINER_CLASS} {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2147483000;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .${CODE_ACTION_BUTTON_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      border: none;
      font-size: 12px;
      line-height: 1;
      color: #1f2937;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .${CODE_ACTION_BUTTON_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.25);
    }

    .${CODE_ACTION_BUTTON_CLASS}:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
    }

    .${CODE_ACTION_BUTTON_CLASS}[data-loading='true'] {
      cursor: wait;
      opacity: 0.7;
      pointer-events: none;
    }

    .${CODE_ACTION_BUTTON_CLASS} .yc-code-action-icon {
      font-size: 14px;
    }
  `;

  document.documentElement.appendChild(style);
}

function detectCodeLanguage(codeElement) {
  const classList = codeElement.className || '';
  const languageMatch = classList.match(/language-([a-z0-9#+]+)/i) || classList.match(/lang-([a-z0-9#+]+)/i);
  if (languageMatch && languageMatch[1]) {
    return languageMatch[1].toLowerCase();
  }

  const dataLang = codeElement.getAttribute('data-language') || codeElement.getAttribute('data-lang');
  if (dataLang) {
    return dataLang.toLowerCase();
  }

  return null;
}

function gatherCodeSnippet(_preElement, codeElement) {
  const text = codeElement?.textContent || '';
  if (text.length <= CODE_SNIPPET_MAX_LENGTH) {
    return text;
  }

  return text.slice(0, CODE_SNIPPET_MAX_LENGTH);
}

function sendExplainRequest(codeElement) {
  const preElement = codeElement.closest('pre');
  if (!preElement) {
    return Promise.reject(new Error('No pre element found'));
  }

  const code = gatherCodeSnippet(preElement, codeElement);
  if (!code.trim()) {
    return Promise.reject(new Error('No code to explain'));
  }

  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    console.warn('Extension context invalidated. Please reload the page.');
    return Promise.reject(new Error('Extension context invalidated'));
  }

  const language = detectCodeLanguage(codeElement);
  const message = {
    type: 'EXPLAIN_CODE_BLOCK',
    code,
    language,
    url: window.location.href,
    title: document.title || null
  };

  return new Promise((resolve, reject) => {
    // Double-check runtime is available before sending
    if (!chrome?.runtime?.sendMessage) {
      console.warn('chrome.runtime.sendMessage is not available');
      reject(new Error('Extension context invalidated'));
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        // Check for runtime errors
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          console.error('Message send error:', lastError.message);
          reject(new Error(lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      reject(error);
    }
  }).catch((error) => {
    // Additional catch to ensure errors are handled
    console.warn('Explain request failed:', error.message);
    throw error;
  });
}

function createExplainButton(codeElement) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = CODE_ACTION_BUTTON_CLASS;
  button.setAttribute('aria-label', 'Explain this code block');
  button.innerHTML = '<span class="yc-code-action-icon">🧠</span><span>Explain</span>';

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.loading === 'true') {
      return;
    }

    const originalHTML = button.innerHTML;
    button.dataset.loading = 'true';
    button.innerHTML = '<span class="yc-code-action-icon">⏳</span><span>Loading...</span>';

    try {
      await sendExplainRequest(codeElement);
      button.innerHTML = '<span class="yc-code-action-icon">✓</span><span>Sent!</span>';
      setTimeout(() => {
        button.innerHTML = originalHTML;
      }, 2000);
    } catch (error) {
      console.error('Explain request error:', error);
      
      if (error.message.includes('Extension context invalidated')) {
        button.innerHTML = '<span class="yc-code-action-icon">⚠️</span><span>Reload page</span>';
        button.title = 'Extension was reloaded. Please refresh the page.';
      } else {
        button.innerHTML = '<span class="yc-code-action-icon">❌</span><span>Error</span>';
        button.title = error.message || 'Failed to send request';
      }
      
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.title = 'Explain this code block';
      }, 3000);
    } finally {
      delete button.dataset.loading;
    }
  });

  return button;
}

function attachCodeActions(preElement) {
  if (preElement.getAttribute(CODE_ACTION_BOUND_ATTR) === 'true') {
    return;
  }

  const codeElement = preElement.querySelector('code');
  if (!codeElement) {
    return;
  }

  preElement.setAttribute(CODE_ACTION_BOUND_ATTR, 'true');
  preElement.classList.add('yc-has-code-actions');

  const container = document.createElement('div');
  container.className = CODE_ACTION_CONTAINER_CLASS;
  container.appendChild(createExplainButton(codeElement));
  preElement.appendChild(container);
}

function scanForCodeBlocks(root = document) {
  const codeBlocks = root.querySelectorAll('pre code');
  codeBlocks.forEach((code) => {
    const pre = code.closest('pre');
    if (pre) {
      attachCodeActions(pre);
    }
  });
}

function observeNewCodeBlocks() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        if (typeof node.matches === 'function' && node.matches('pre')) {
          attachCodeActions(node);
        }

        scanForCodeBlocks(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function setupCodeExplainButtons() {
  ensureCodeActionStyles();
  scanForCodeBlocks();
  observeNewCodeBlocks();
}

function ensureShadowHost() {
  if (shadowHost && document.contains(shadowHost)) {
    return;
  }

  shadowHost = document.createElement('div');
  shadowHost.id = INLINE_BUBBLE_ID;
  shadowHost.style.position = 'absolute';
  shadowHost.style.top = '0';
  shadowHost.style.left = '0';
  shadowHost.style.zIndex = '2147483647';
  shadowHost.style.pointerEvents = 'none';

  shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(shadowHost);

  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);
}

function getStyles() {
  return `
    :host {
      all: initial;
    }

    .yc-bubble-container {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #111827;
      max-width: 320px;
      width: max-content;
      pointer-events: auto;
    }

    .yc-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .yc-bubble {
      position: relative;
      border-radius: 16px;
      padding: 12px 14px;
      background: #ffffff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    .yc-bubble.has-tail::after {
      content: '';
      position: absolute;
      top: -6px;
      left: 24px;
      width: 12px;
      height: 12px;
      background: #ffffff;
      border-left: 1px solid rgba(15, 23, 42, 0.08);
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      transform: rotate(45deg);
    }

    .yc-bubble-heading {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #1d4ed8;
      margin-bottom: 8px;
    }

    .yc-selection-preview {
      font-size: 13px;
      line-height: 1.4;
      color: #1f2937;
      background: rgba(37, 99, 235, 0.08);
      border-left: 3px solid rgba(29, 78, 216, 0.9);
      padding: 8px 10px;
      border-radius: 8px;
      margin-bottom: 8px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .yc-question-form {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .yc-question-input {
      flex: 1;
      border-radius: 12px;
      border: 1px solid rgba(37, 99, 235, 0.45);
      padding: 8px 12px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .yc-question-input:focus {
      border-color: rgba(29, 78, 216, 0.9);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    }

    .yc-send-button {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      cursor: pointer;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }

    .yc-send-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
    }

    .yc-send-button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
      box-shadow: none;
      transform: none;
    }

    .yc-send-icon {
      display: block;
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-bottom: 11px solid currentColor;
      margin-top: 2px;
    }

    .yc-answer-bubble {
      background: #f9fafb;
      color: #1f2937;
    }

    .yc-answer-content {
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .yc-loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #1d4ed8;
    }

    .yc-spinner {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(37, 99, 235, 0.2);
      border-top-color: rgba(29, 78, 216, 0.85);
      animation: yc-spin 0.75s linear infinite;
    }

    .yc-error {
      color: #dc2626;
    }

    @keyframes yc-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
}

function observeSelection() {
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      activeSelectionRect = null;
      activeSelectionText = '';
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    activeSelectionRect = rect;
    activeSelectionText = selection.toString();
  });
}

function positionHost() {
  if (!shadowHost || !activeSelectionRect) {
    return;
  }

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  const top = activeSelectionRect.top + scrollY - 12;
  const left = activeSelectionRect.left + scrollX;

  shadowHost.style.top = `${Math.max(top, scrollY + 12)}px`;
  shadowHost.style.left = `${Math.max(left, scrollX + 12)}px`;
}

function renderBubble(questionText = '') {
  if (!shadowRoot) {
    throw new Error('Shadow root missing');
  }

  shadowRoot.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  container.className = 'yc-bubble-container';

  const stack = document.createElement('div');
  stack.className = 'yc-stack';

  const questionBubble = document.createElement('div');
  questionBubble.className = 'yc-bubble has-tail';

  const heading = document.createElement('div');
  heading.className = 'yc-bubble-heading';
  heading.textContent = 'Ask about this';

  const selectionPreview = document.createElement('div');
  selectionPreview.className = 'yc-selection-preview';
  selectionPreview.textContent = activeSelectionText.trim();

  const form = document.createElement('div');
  form.className = 'yc-question-form';

  const input = document.createElement('textarea');
  input.className = 'yc-question-input';
  input.placeholder = 'What do you want to know?';
  input.rows = 2;
  input.value = questionText;

  const sendButton = document.createElement('button');
  sendButton.className = 'yc-send-button';
  sendButton.title = 'Send question';

  const icon = document.createElement('span');
  icon.className = 'yc-send-icon';

  sendButton.appendChild(icon);

  form.appendChild(input);
  form.appendChild(sendButton);

  questionBubble.appendChild(heading);
  if (activeSelectionText.trim()) {
    questionBubble.appendChild(selectionPreview);
  }
  questionBubble.appendChild(form);

  stack.appendChild(questionBubble);
  container.appendChild(stack);
  shadowRoot.appendChild(container);

  requestAnimationFrame(positionHost);

  return { container, stack, input, sendButton };
}

function showAnswerBubble(stack, content) {
  const answerBubble = document.createElement('div');
  answerBubble.className = 'yc-bubble yc-answer-bubble';

  const answerContent = document.createElement('div');
  answerContent.className = 'yc-answer-content';
  answerContent.innerHTML = content;

  stack.appendChild(answerBubble);
  answerBubble.appendChild(answerContent);

  requestAnimationFrame(positionHost);
}

function showLoadingMessage(stack) {
  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'yc-bubble yc-answer-bubble';
  loadingBubble.dataset.loading = 'true';

  const loading = document.createElement('div');
  loading.className = 'yc-loading';

  const spinner = document.createElement('span');
  spinner.className = 'yc-spinner';

  const text = document.createElement('span');
  text.textContent = 'Thinking...';

  loading.appendChild(spinner);
  loading.appendChild(text);

  loadingBubble.appendChild(loading);
  stack.appendChild(loadingBubble);

  requestAnimationFrame(positionHost);

  return loadingBubble;
}

function updateLoadingBubble(bubble, innerHtml, isError = false) {
  if (!bubble) {
    return;
  }

  bubble.innerHTML = '';

  const content = document.createElement('div');
  content.className = isError ? 'yc-error' : 'yc-answer-content';
  content.innerHTML = innerHtml;
  bubble.appendChild(content);
}

function removeBubble() {
  if (!shadowHost) {
    return;
  }

  shadowHost.remove();
  shadowHost = null;
  shadowRoot = null;
}

async function gatherPageLinks() {
  try {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((link) => ({
        text: (link.textContent || '').trim().slice(0, 80),
        url: link.href
      }))
      .filter((link) => link.text && link.url);

    return links.slice(0, 100);
  } catch (error) {
    console.warn('Failed to gather links from page', error);
    return [];
  }
}

async function requestAnalysis(question) {
  const domain = window.location.hostname;
  const url = window.location.href;
  const links = await gatherPageLinks();

  const body = {
    query: question,
    domain,
    url,
    links,
    selectionText: activeSelectionText
  };

  const response = await fetch('http://localhost:3001/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function renderMarkdown(text) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n\n/g, '<br><br>');
}

function handleSend(stack, input, sendButton) {
  const question = input.value.trim();
  if (!question) {
    input.focus();
    return;
  }

  sendButton.disabled = true;
  input.disabled = true;

  const loadingBubble = showLoadingMessage(stack);

  requestAnalysis(question)
    .then((data) => {
      updateLoadingBubble(loadingBubble, renderMarkdown(data.result));
    })
    .catch((error) => {
      updateLoadingBubble(loadingBubble, `Error: ${error.message}`, true);
    })
    .finally(() => {
      sendButton.disabled = false;
      input.disabled = false;
    });
}

function registerEvents(container, stack, input, sendButton) {
  const closeOnOutsideClick = (event) => {
    if (!shadowRoot) {
      return;
    }

    if (shadowRoot.contains(event.target)) {
      return;
    }

    removeBubble();
    document.removeEventListener('mousedown', closeOnOutsideClick, true);
  };

  document.addEventListener('mousedown', closeOnOutsideClick, true);

  sendButton.addEventListener('click', (event) => {
    event.preventDefault();
    handleSend(stack, input, sendButton);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(stack, input, sendButton);
    }
  });
}

function showInlineBubble(questionText = '', selectionText = '') {
  ensureShadowHost();
  const { container, stack, input, sendButton } = renderBubble(questionText);

  if (selectionText) {
    activeSelectionText = selectionText;
  }

  registerEvents(container, stack, input, sendButton);

  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  requestAnimationFrame(positionHost);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_INLINE_BUBBLE') {
    showInlineBubble('', message.selectionText);
  }

  if (message.type === 'REFRESH_CODE_ACTIONS') {
    setupCodeExplainButtons();
  }
});

observeSelection();

setupCodeExplainButtons();
