// Detects the ISO language code of the given text
export async function detectLanguage(text) {
  const detector = await LanguageDetector.create();
  const [topResult] = await detector.detect(text.slice(0, 500));
  return topResult.detectedLanguage.split('-')[0];
}
