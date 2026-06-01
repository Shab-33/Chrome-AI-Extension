const summarizer = await Summarizer.create({
    type: 'tldr',           // 'tldr' | 'key-points' | 'teaser' | 'headline'
    format: 'plain-text',   // 'plain-text' | 'markdown'
    length: 'short',        // 'short' | 'medium' | 'long'
    outputLanguage: 'en',
    sharedContext: 'This is a news article.',
  });

const summary = await summarizer.summarize(
    document.body.innerText.slice(0, 4000),
    { context: 'Article intended for a general audience.' }
  );
  console.log(summary);

const stream = summarizer.summarizeStreaming(
    document.body.innerText.slice(0, 4000)
  );
  
  for await (const chunk of stream) {
    document.getElementById('output').textContent = chunk;
  }

  if ('Translator' in self) {
    // The Translator API is supported
  }

const availability = await Translator.availability({
    sourceLanguage: 'es',
    targetLanguage: 'en'
});

const translator = await Translator.create({
    sourceLanguage: 'fr',
    targetLanguage: 'en'
  });

  const result = await translator.translate(
    'Où est le prochain arrêt de bus, s\'il vous plaît?'
  );
  console.log(result);
  // "Where is the next bus stop, please?"

const session = await LanguageModel.create();
const result = await session.prompt('Write me a haiku about JavaScript');
console.log(result);

const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Be concise and direct.'
      }
    ]
  });
  
  const result = await session.prompt('What causes a memory leak in JavaScript?');
  console.log(result);