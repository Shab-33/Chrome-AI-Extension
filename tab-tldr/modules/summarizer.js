// modules/summarizer.js
// Responsible for generating a TL;DR summary using Chrome's Summarizer API.

/**
 * Summarises the given text into a short TL;DR.
 * @param {string} text - The page text to summarise.
 * @returns {Promise<string>} The generated summary.
 */
export async function summarizeText(text) {
  const summarizer = await Summarizer.create({
    type: "tldr",
    length: "short",
    outputLanguage: "en",
  });
  return await summarizer.summarize(text);
}
