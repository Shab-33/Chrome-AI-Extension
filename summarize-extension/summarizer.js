async function summarisePage() {
  // Step 1: grab the text from the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result: pageText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 4000),
  });

  // Step 2: create the summariser

  // Step 3: summarise and return
}
