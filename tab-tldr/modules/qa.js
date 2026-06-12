let qaSession = null;
let hasGivenContext = false;

// Initializes or returns the existing Q&A session
async function getOrCreateSession(pageText) {
  if (qaSession) {
    return qaSession;
  }

  qaSession = await LanguageModel.create({
    systemPrompt: `You are an AI assistant integrated into a browser extension. Your task is to help the user understand the webpage they are currently viewing. Always provide helpful, concise answers based on the context provided.`,
  });
  
  hasGivenContext = false;

  return qaSession;
}

// Asks a question using the Prompt API
export async function askQuestion(pageText, question) {
  if (!window.LanguageModel) {
    throw new Error("Prompt API (LanguageModel) is not supported or enabled in this browser.");
  }

  const session = await getOrCreateSession(pageText);
  
  let finalQuestion = question;
  if (!hasGivenContext) {
    const snippet = pageText.slice(0, 4000);
    finalQuestion = `Here is the text of the webpage we are looking at:

--- WEBPAGE TEXT ---
${snippet}
-------------------

Based on the text above, please answer my question: ${question}`;
    
    hasGivenContext = true;
  }
  
  const answer = await session.prompt(finalQuestion);
  return answer;
}

// Clears the active chat session
export function clearQaSession() {
  if (qaSession) {
    qaSession.destroy();
    qaSession = null;
  }
  hasGivenContext = false;
}
