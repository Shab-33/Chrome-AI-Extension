// Extracts 3-5 key points from text using the Prompt API
export async function extractKeyPoints(text) {
  const snippet = text.slice(0, 2000);

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
