async function summarisePage() {
  // Step 1: grab the text from the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result: pageText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 4000),
  });

  // Step 2: create the summariser
  const summarizer = await Summarizer.create({
    type: "tldr",
    length: "short",
    outputLanguage: "en",
  });

  // Step 3: summarise and return
  const summary = await summarizer.summarize(pageText);
  return summary;
}
