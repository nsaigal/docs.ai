const MENU_ID = 'inline-ask-about-this';
const EXPLAIN_MESSAGE = 'EXPLAIN_CODE_BLOCK';

const tabExplainRequests = new Map();

function ensureSidePanel(tab) {
  if (!tab?.windowId) {
    return Promise.resolve();
  }

  return chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
    console.warn('Failed to open side panel', error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Ask about this',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_INLINE_BUBBLE',
      selectionText: info.selectionText ?? ''
    });
  } catch (error) {
    console.warn('Failed to send inline bubble message', error);
  }
});


// Background script to handle sidePanel opening
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== EXPLAIN_MESSAGE) {
    return;
  }

  const tabId = sender?.tab?.id;
  if (!tabId) {
    console.warn('Explain request missing tab context');
    return;
  }

  tabExplainRequests.set(tabId, {
    code: message.code,
    language: message.language,
    url: message.url,
    title: message.title,
    receivedAt: Date.now()
  });

  chrome.tabs.get(tabId, (tab) => {
    ensureSidePanel(tab).finally(() => {
      chrome.runtime.sendMessage({
        type: 'REFRESH_CODE_ACTIONS'
      });

      chrome.runtime.sendMessage({
        type: 'CODE_EXPLAIN_READY',
        tabId
      });
    });
  });

  sendResponse?.({ ok: true });
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'YCH_SIDE_PANEL') {
    return;
  }

  function forwardExplainRequest(tabId) {
    const payload = tabExplainRequests.get(tabId);
    if (!payload) {
      return;
    }

    port.postMessage({
      type: 'CODE_EXPLAIN_REQUEST',
      tabId,
      payload
    });
    tabExplainRequests.delete(tabId);
  }

  port.onMessage.addListener((msg) => {
    if (msg?.type === 'CODE_EXPLAIN_CONSUME' && typeof msg.tabId === 'number') {
      forwardExplainRequest(msg.tabId);
    }
  });

  port.onDisconnect.addListener(() => {
    port.onMessage.removeListener(() => {});
  });
});