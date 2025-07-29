// Background script for Code Guide Chrome Extension
// Handles context menus and installation events

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set up default settings on first install
    chrome.storage.local.set({
      codeGuideSettings: {
        apiKey: '',
        guidanceLevel: 'balanced',
        focusMode: 'mixed'
      }
    });

    // Create context menu for quick analysis
    chrome.contextMenus.create({
      id: 'analyzeCode',
      title: 'Analyze with Code Guide',
      contexts: ['selection'],
      documentUrlPatterns: ['<all_urls>']
    });

    chrome.contextMenus.create({
      id: 'analyzePage',
      title: 'Analyze page code',
      contexts: ['page'],
      documentUrlPatterns: ['<all_urls>']
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeCode' && info.selectionText) {
    // Store selected text for analysis
    chrome.storage.local.set({
      selectedCodeForAnalysis: {
        text: info.selectionText,
        url: tab.url,
        timestamp: Date.now()
      }
    });
    
    // Open popup by clicking the action button
    chrome.action.openPopup();
  } else if (info.menuItemId === 'analyzePage') {
    // Open popup for page analysis
    chrome.action.openPopup();
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedCode') {
    // Get stored selected code for analysis
    chrome.storage.local.get(['selectedCodeForAnalysis'], (result) => {
      if (result.selectedCodeForAnalysis) {
        sendResponse({ success: true, data: result.selectedCodeForAnalysis });
        // Clear after use
        chrome.storage.local.remove(['selectedCodeForAnalysis']);
      } else {
        sendResponse({ success: false, message: 'No selected code found' });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

// Update badge text based on API key status
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.codeGuideSettings) {
    const settings = changes.codeGuideSettings.newValue;
    if (settings && settings.apiKey) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10a37f' });
    } else {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff5722' });
    }
  }
});