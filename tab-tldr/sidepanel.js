import { extractPageText } from "./modules/page-extractor.js";
import { detectLanguage } from "./modules/language-detector.js";
import { summarizeText } from "./modules/summarizer.js";
import { extractKeyPoints } from "./modules/key-points.js";
import { translateWebpage } from "./modules/translator.js";
import { askQuestion, clearQaSession } from "./modules/qa.js";

// Analyse Button
document
  .getElementById("analyseBtn")
  .addEventListener("click", analyseCurrentTab);

async function analyseCurrentTab() {
  const loading = document.getElementById("loading");
  const output = document.getElementById("output");
  const errorDiv = document.getElementById("error");

  loading.classList.remove("hidden");
  output.classList.add("hidden");
  errorDiv.classList.add("hidden");

  try {
    const { pageText } = await extractPageText();
    const detectedLang = await detectLanguage(pageText);

    loading.classList.add("hidden");
    output.classList.remove("hidden");
    document.getElementById("summaryText").textContent = "";
    const list = document.getElementById("keyPointsList");
    list.innerHTML = "<li>Extracting key points...</li>";

    const summary = await summarizeText(pageText, (currentText) => {
      document.getElementById("summaryText").textContent = currentText;
    });

    const keyPoints = await extractKeyPoints(pageText);

    list.innerHTML = "";
    keyPoints.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point;
      list.appendChild(li);
    });

    window._pageText = pageText;
    window._sourceLang = detectedLang;
    window._isAnalysed = true;
  } catch (err) {
    loading.classList.add("hidden");
    errorDiv.classList.remove("hidden");
    errorDiv.textContent = `Something went wrong: ${err.message}`;
    console.error(err);
  }
}

// Translate Webpage Button
document
  .getElementById("translatePageBtn")
  .addEventListener("click", async () => {
    const btn = document.getElementById("translatePageBtn");
    const targetLang = document.getElementById("targetLangSelect").value;

    if (targetLang === "default") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.reload(tab.id);
      window._sourceLang = null;
      btn.textContent = "Translate this page";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Detecting language...";

    try {
      if (!window._sourceLang) {
        const { pageText } = await extractPageText();
        window._sourceLang = await detectLanguage(pageText);
      }

      if (window._sourceLang === targetLang) {
        alert("The page language is already the same as the target language.");
        btn.disabled = false;
        btn.textContent = "Translate this page";
        return;
      }

      await translateWebpage(window._sourceLang, targetLang, btn);
    } catch (err) {
      alert(`Could not start translation: ${err.message}`);
      btn.disabled = false;
      btn.textContent = "Translate this page";
    }
  });

// Q&A Chat Section
const chatHistory = document.getElementById("chatHistory");
const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

function addChatMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble", role);
  
  if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = marked.parse(text);
  }
  
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

askBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question) return;

  addChatMessage("user", question);
  questionInput.value = "";
  
  askBtn.disabled = true;
  askBtn.textContent = "Thinking...";

  try {
    if (!window._pageText) {
      const { pageText } = await extractPageText();
      window._pageText = pageText;
    }

    const answer = await askQuestion(window._pageText, question);
    addChatMessage("assistant", answer);
  } catch (err) {
    addChatMessage("assistant", `Error: ${err.message}`);
    console.error(err);
  } finally {
    askBtn.disabled = false;
    askBtn.textContent = "Ask";
  }
});

clearChatBtn.addEventListener("click", () => {
  clearQaSession();
  chatHistory.innerHTML = "";
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askBtn.click();
  }
});
