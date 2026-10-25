export const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Modify token handling
export async function getToken() {
  // Return dummy token since we're using Flask backend directly
  return 'flask-backend-token';
}

export function getBrowserType() {
  return typeof browser !== 'undefined' ? 'firefox' : 'chrome';
}

export async function executeScript(tabId, files) {
  if (getBrowserType() === 'firefox') {
    for (const file of files) {
      await browser.tabs.executeScript(tabId, { file });
    }
  } else {
    await chrome.scripting.executeScript({
      target: { tabId },
      files
    });
  }
}

export async function connectToBackground(name) {
  return browserAPI.runtime.connect({ name });
}

export async function sendMessage(message) {
  return browserAPI.runtime.sendMessage(message);
}

export async function injectContentScript(tabId) {
  if (getBrowserType() === 'firefox') {
    await executeScript(tabId, ['browser-polyfill.js', 'content.js']);
  } else {
    await executeScript(tabId, ['content.js']);
  }
}

export async function openSidePanel() {
  try {
    if (browserAPI.sidePanel && browserAPI.sidePanel.open) {
      await browserAPI.sidePanel.open({ windowId: browserAPI.windows.WINDOW_ID_CURRENT });
    }
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
}

export async function toggleSidebar() {
  if (getBrowserType() === 'firefox') {
    try {
      // Check if sidebar exists in current window
      const currentWindow = await browser.windows.getCurrent();
      await browser.sidebarAction.close();
      // Longer delay
      await new Promise(resolve => setTimeout(resolve, 250));
      await browser.sidebarAction.open({ windowId: currentWindow.id });
    } catch (e) {
      console.error('Toggle sidebar error:', e);
      throw e;
    }
  }
}
