// modules/page-extractor.js
// Responsible for extracting visible text from the active browser tab.

const RESTRICTED_PREFIXES = [
  "chrome://",
  "edge://",
  "about:",
  "devtools://",
  "chrome-extension://",
];

/**
 * Returns the active tab and its visible text content.
 * Throws a user-friendly error if the page is a restricted internal URL.
 * @returns {Promise<{ tab: chrome.tabs.Tab, pageText: string }>}
 */
export async function extractPageText() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  // Guard: cannot inject scripts into chrome:// or other internal pages
  const isRestricted = RESTRICTED_PREFIXES.some(
    (prefix) => !tab.url || tab.url.startsWith(prefix)
  );
  if (isRestricted) {
    throw new Error(
      "This page cannot be analysed. Extensions cannot read chrome:// or other internal browser pages. Please navigate to a regular webpage and try again."
    );
  }

  const [{ result: pageText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 4000),
  });

  return { tab, pageText };
}
