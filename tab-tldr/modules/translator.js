// Returns the Translator API constructor available in the current context
function getTranslatorAPI() {
  if (typeof translation !== "undefined") return translation;
  if (typeof Translator !== "undefined") return Translator;
  return null;
}

// Creates a translator instance
async function createTranslator(translationObj, sourceLang, targetLang, onProgress) {
  const options = {
    sourceLanguage: sourceLang.split('-')[0],
    targetLanguage: targetLang.split('-')[0],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const progress = Math.round((e.loaded / e.total) * 100);
        if (onProgress) onProgress(progress);
      });
    },
  };
  
  if (typeof translationObj.createTranslator === "function") {
    return translationObj.createTranslator(options);
  }
  return translationObj.create(options);
}

// Translates the active webpage's DOM text nodes in-place
export async function translateWebpage(sourceLang, targetLang, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Checking...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const translationObj = getTranslatorAPI();
    if (!translationObj) {
      throw new Error("Chrome's Translator API is not supported in this browser.");
    }

    let canTranslate = "readily";
    if (typeof translationObj.canTranslate === "function") {
      canTranslate = await translationObj.canTranslate({
        sourceLanguage: sourceLang.split('-')[0],
        targetLanguage: targetLang.split('-')[0],
      });
    }

    if (canTranslate === "no") {
      alert(`Translation from ${sourceLang.toUpperCase()} to ${targetLang.toUpperCase()} is not supported.`);
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    let translator;
    if (canTranslate === "after-download") {
      btn.textContent = "Downloading pack: 0%...";
      translator = await createTranslator(
        translationObj, sourceLang, targetLang,
        (progress) => { btn.textContent = `Downloading pack: ${progress}%...`; }
      );
    } else {
      translator = await createTranslator(translationObj, sourceLang, targetLang);
    }

    btn.textContent = "Translating DOM...";

    const [{ result: pageTexts }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const tag = node.parentNode.tagName;
            if (["SCRIPT","STYLE","CODE","PRE","NOSCRIPT","IFRAME","SVG","TEXTAREA"].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.parentNode.closest('[translate="no"]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        const texts = [];
        let n;
        while ((n = walk.nextNode())) texts.push(n.nodeValue);
        return texts;
      },
    });

    const translatedTexts = [];
    const batchSize = 10;
    for (let i = 0; i < pageTexts.length; i += batchSize) {
      const batch = pageTexts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (t) => {
          try { return await translator.translate(t); }
          catch { return t; }
        })
      );
      translatedTexts.push(...results);
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [translatedTexts],
      func: (translations) => {
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const tag = node.parentNode.tagName;
            if (["SCRIPT","STYLE","CODE","PRE","NOSCRIPT","IFRAME","SVG","TEXTAREA"].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.parentNode.closest('[translate="no"]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let n, idx = 0;
        while ((n = walk.nextNode()) && idx < translations.length) {
          n.nodeValue = translations[idx++];
        }
      },
    });

    btn.textContent = "Webpage Translated!";
  } catch (err) {
    alert(`Webpage translation failed: ${err.message}`);
    console.error("DOM translation error:", err);
    btn.textContent = originalText;
  } finally {
    btn.disabled = false;
  }
}
