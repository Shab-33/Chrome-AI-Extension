// modules/language-detector.js
// Responsible for detecting the language of a piece of text using Chrome's LanguageDetector API.

/**
 * Detects the language of the given text.
 * @param {string} text - The text to analyse (typically first ~500 chars of page).
 * @returns {Promise<string>} The ISO language code (e.g. "fr", "de", "en").
 */
export async function detectLanguage(text) {
  const detector = await LanguageDetector.create();
  const [topResult] = await detector.detect(text.slice(0, 500));
  return topResult.detectedLanguage;
}
