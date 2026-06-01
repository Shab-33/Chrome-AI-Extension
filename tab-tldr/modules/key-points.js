// modules/key-points.js
// Responsible for extracting structured key points using Chrome's Prompt API (LanguageModel).

/**
 * Extracts 3-5 key points from the given text using the Prompt API.
 * Attempts the modern `responseConstraint` schema approach first,
 * then falls back to a raw JSON prompt if the browser doesn't support it.
 * @param {string} text - The page text to extract points from.
 * @returns {Promise<string[]>} Array of key point strings.
 */
export async function extractKeyPoints(text) {
  const snippet = text.slice(0, 2000);

  // ── Attempt 1: responseConstraint (guaranteed JSON output) ──
  try {
    const schema = {
      type: "object",
      properties: {
        points: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 5,
        },
      },
      required: ["points"],
    };

    const session = await LanguageModel.create({
      systemPrompt: "You extract key points from text.",
      expectedInputLanguages: ["en"],
      expectedOutputLanguages: ["en"],
    });

    const result = await session.prompt(
      `Extract 3-5 key points from: ${snippet}`,
      { responseConstraint: schema }
    );
    const parsed = JSON.parse(result);
    return parsed.points || [];
  } catch (primaryErr) {
    console.warn(
      "responseConstraint approach failed, falling back to basic prompt.",
      primaryErr
    );
  }

  // ── Attempt 2: Basic prompt with manual JSON cleanup ──
  const session = await LanguageModel.create({
    systemPrompt:
      "You extract key points from text. Return ONLY a raw JSON array of strings. No markdown. No backticks. No explanation.",
    expectedInputLanguages: ["en"],
    expectedOutputLanguages: ["en"],
  });

  const rawPoints = await session.prompt(
    `Extract 3 to 5 key points from this text.
     Return ONLY a JSON array like: ["point one", "point two", "point three"]
     
     Text: ${snippet}`
  );

  const cleaned = rawPoints.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return [rawPoints];
  }
}
