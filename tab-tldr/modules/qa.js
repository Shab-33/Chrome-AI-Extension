// modules/qa.js
// Responsible for maintaining a multi-turn chat session with the page using Chrome's Prompt API.

let qaSession = null;

/**
 * Initializes or returns the existing Q&A session for the given text.
 * @param {string} pageText - The extracted text of the current page.
 * @returns {Promise<Object>} The active LanguageModel session.
 */
async function getOrCreateSession(pageText) {
  if (qaSession) {
    return qaSession;
  }

  // Cap text length to avoid exceeding context window limits
  const snippet = pageText.slice(0, 4000);
  
  qaSession = await LanguageModel.create({
    systemPrompt: `You are an AI assistant integrated into a browser extension. Your task is to help the user understand the webpage they are currently viewing. 
The text of the webpage is provided below. Treat this text as the primary subject of the user's questions or requests (for example, if they say "summarize this page", summarize the text below). Do not ask the user to provide the text, because it is already provided here.

--- WEBPAGE TEXT ---
${snippet}
-------------------`,
    expectedInputLanguages: ["en"],
    expectedOutputLanguages: ["en"],
  });

  return qaSession;
}

/**
 * Asks a question using the Prompt API, maintaining context from previous questions.
 * @param {string} pageText - The extracted text of the current page.
 * @param {string} question - The user's question.
 * @returns {Promise<string>} The AI's answer.
 */
export async function askQuestion(pageText, question) {
  if (!window.LanguageModel) {
    throw new Error("Prompt API (LanguageModel) is not supported or enabled in this browser.");
  }

  const session = await getOrCreateSession(pageText);
  
  // prompt() retains the conversation history within the session automatically.
  const answer = await session.prompt(question);
  return answer;
}

/**
 * Clears the active chat session.
 */
export function clearQaSession() {
  if (qaSession) {
    qaSession.destroy();
    qaSession = null;
  }
}
