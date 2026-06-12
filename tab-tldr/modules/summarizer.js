// Summarises the given text into a short TL;DR
export async function summarizeText(text, onUpdate) {
  const summarizer = await Summarizer.create({
    type: "tldr",
    length: "short",
    outputLanguage: "en",
  });
  
  if (!onUpdate) {
    return await summarizer.summarize(text);
  }
  
  const stream = summarizer.summarizeStreaming(text);
  let result = '';
  for await (const chunk of stream) {
    const newContent = chunk.startsWith(result) ? chunk.slice(result.length) : chunk;
    result += newContent;
    onUpdate(result);
  }
  return result;
}
