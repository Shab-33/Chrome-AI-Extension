# Agent Handover: Tab TL;DR Chrome Extension + Learn and Share
> **For:** Antigravity AI Agent  
> **Owner:** Shehab (junior developer / placement student at EDF Energy)  
> **Status:** Extension partially built and working. Needs improvements + polish before presentation.  
> **Presentation date:** May (exact date TBC)  
> **Last updated:** May 2026

---

## 1. Context and Background

Shehab is a placement student at EDF (a major UK energy company), presenting a "Learn and Share" session to his experienced full-stack development team. The audience covers the full stack — frontend, backend, APIs, data/ML/AI, and DevOps. They are senior engineers, not beginners.

**Key constraints:**
- 30+ minute slot
- Must include a practical demo or hands-on element
- Topic must be something the team likely does NOT already know
- Should be genuinely useful to them day-to-day
- Shehab has ~2 weeks total to prepare

**Why this topic was chosen:**
After researching multiple options (MCP servers, PGlite, Observability 2.0, Stagehand), Chrome's Built-in AI APIs were selected as the top pick because:
- Genuinely novel even to senior devs (most assume "LLM = API call to OpenAI")
- Live demo is visual and immediately impressive
- Extension is buildable in 2 weeks by a junior dev
- No API keys, no cost, no data egress — story tells itself
- MCP was ruled out because a colleague named Eugenie already presented an MCP session to the same team in May 2025

---

## 2. The Extension: Tab TL;DR

### What it does
A Chrome extension that opens as a side panel on any webpage and uses Chrome's built-in Gemini Nano model to:
1. Summarise the page as a TL;DR (Summarizer API)
2. Detect the page language (LanguageDetector API)
3. Translate foreign-language pages to English (Translator API)
4. Extract structured key points as JSON (LanguageModel / Prompt API with responseConstraint)

### Current working state
- Extension loads correctly in Chrome via `chrome://extensions` developer mode
- Side panel opens when extension icon is clicked
- **Summarizer API is working** (after fixes applied — see gotchas section)
- **LanguageDetector and Translator are wired up** but not fully tested end-to-end
- **Key points extraction with Prompt API** is wired up but had JSON parsing issues (fix applied — see below)
- Basic UI exists with spinner, error state, output sections

### File structure
```
tab-tldr/
├── manifest.json
├── background.js
├── sidepanel.html
├── sidepanel.js
└── styles.css
```

---

## 3. Current Code (Full — as of handover)

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Tab TL;DR",
  "version": "1.0",
  "description": "Summarise any webpage using Chrome's built-in AI. No API key needed.",

  "permissions": ["activeTab", "sidePanel", "scripting"],

  "host_permissions": ["<all_urls>"],

  "side_panel": {
    "default_path": "sidepanel.html"
  },

  "action": {
    "default_title": "Open Tab TL;DR"
  },

  "background": {
    "service_worker": "background.js"
  }
}
```

**Critical note:** `"host_permissions": ["<all_urls>"]` is required. Without it, `chrome.scripting.executeScript` throws `"Cannot access contents of the page. Extension manifest must request permission to access the respective host."` This was a real bug that was hit and fixed.

---

### background.js
```js
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
```

---

### sidepanel.html
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tab TL;DR</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">

    <h1>Tab TL;DR 🧠</h1>
    <p class="subtitle">Powered by Gemini Nano · No API key · No network</p>

    <button id="analyseBtn" class="btn primary">Analyse this page</button>

    <div id="loading" class="loading hidden">
      <div class="spinner"></div>
      <p>Thinking with Gemini Nano...</p>
    </div>

    <div id="error" class="error hidden"></div>

    <div id="output" class="hidden">

      <div id="languageBanner" class="language-banner hidden">
        <span>Detected: <strong id="detectedLang"></strong></span>
        <button id="translateBtn" class="btn secondary small">Translate to English</button>
      </div>

      <h3>TL;DR</h3>
      <p id="summaryText"></p>

      <h3>Key Points</h3>
      <ul id="keyPointsList"></ul>

      <div id="translationSection" class="hidden">
        <h3>Translation</h3>
        <p id="translatedText"></p>
      </div>

    </div>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>
```

---

### sidepanel.js
```js
document.getElementById('analyseBtn').addEventListener('click', analyseCurrentTab);

async function analyseCurrentTab() {
  const loading  = document.getElementById('loading');
  const output   = document.getElementById('output');
  const errorDiv = document.getElementById('error');

  loading.classList.remove('hidden');
  output.classList.add('hidden');
  errorDiv.classList.add('hidden');

  try {

    // STEP 1: Grab page text via scripting injection
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 4000)
    });

    // STEP 2: Detect language
    const detector = await LanguageDetector.create();
    const [topResult] = await detector.detect(pageText.slice(0, 500));
    const detectedLang = topResult.detectedLanguage;

    // STEP 3: Summarise
    const summarizer = await Summarizer.create({
      type: 'tldr',
      length: 'short',
      outputLanguage: 'en'
    });
    const summary = await summarizer.summarize(pageText);

    // STEP 4: Key points via Prompt API (with JSON cleanup fallback)
    const session = await LanguageModel.create({
      systemPrompt: 'You extract key points from text. Return ONLY a raw JSON array of strings. No markdown. No backticks. No explanation.'
    });

    const rawPoints = await session.prompt(
      `Extract 3 to 5 key points from this text.
       Return ONLY a JSON array like: ["point one", "point two", "point three"]
       
       Text: ${pageText.slice(0, 2000)}`
    );

    // Strip markdown fences — Gemini Nano sometimes wraps output in ```json
    const cleaned = rawPoints.replace(/```json|```/g, '').trim();
    let keyPoints = [];
    try {
      keyPoints = JSON.parse(cleaned);
    } catch {
      keyPoints = [rawPoints];
    }

    // STEP 5: Update UI
    document.getElementById('summaryText').textContent = summary;

    const list = document.getElementById('keyPointsList');
    list.innerHTML = '';
    keyPoints.forEach(point => {
      const li = document.createElement('li');
      li.textContent = point;
      list.appendChild(li);
    });

    if (detectedLang && detectedLang !== 'en') {
      document.getElementById('detectedLang').textContent = detectedLang.toUpperCase();
      document.getElementById('languageBanner').classList.remove('hidden');
      window._pageText = pageText;
      window._sourceLang = detectedLang;
    }

    loading.classList.add('hidden');
    output.classList.remove('hidden');

  } catch (err) {
    loading.classList.add('hidden');
    errorDiv.classList.remove('hidden');
    errorDiv.textContent = `Something went wrong: ${err.message}`;
    console.error(err);
  }
}

document.getElementById('translateBtn').addEventListener('click', async () => {
  try {
    const translator = await Translator.create({
      sourceLanguage: window._sourceLang,
      targetLanguage: 'en'
    });
    const translated = await translator.translate(window._pageText.slice(0, 2000));
    document.getElementById('translatedText').textContent = translated;
    document.getElementById('translationSection').classList.remove('hidden');
  } catch (err) {
    console.error('Translation failed:', err);
  }
});
```

---

### styles.css
```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  background: #f8f9fa;
  color: #1a1a1a;
}

.container { padding: 20px; }

h1 { font-size: 18px; margin-bottom: 4px; }

.subtitle {
  font-size: 11px;
  color: #888;
  margin-bottom: 20px;
}

h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #888;
  margin: 20px 0 8px;
}

p { line-height: 1.6; color: #333; }

ul { padding-left: 18px; line-height: 1.9; color: #333; }

.btn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 8px;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn.primary { background: #1a73e8; color: white; }
.btn.secondary { background: #e8f0fe; color: #1a73e8; }
.btn.small { width: auto; padding: 5px 10px; font-size: 12px; margin: 0; }

.language-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff3cd;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}

.loading {
  text-align: center;
  padding: 40px 0;
  color: #888;
}

.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e0e0e0;
  border-top-color: #1a73e8;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error {
  background: #fce8e6;
  color: #c5221f;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 13px;
}

.hidden { display: none !important; }
```

---

## 4. Known Bugs Fixed (Do Not Re-introduce)

| Bug | Root cause | Fix applied |
|-----|-----------|-------------|
| `Cannot access contents of the page` | Missing `host_permissions` in manifest | Added `"host_permissions": ["<all_urls>"]` |
| `QuotaExceededError: The input is too large` | Passing full `document.body.innerText` to Summarizer | Slice to 4000 chars: `.slice(0, 4000)` |
| `No output language was specified` warning | Chrome now requires `outputLanguage` param | Added `outputLanguage: "en"` to all API calls |
| `SyntaxError: Unexpected token` on JSON.parse | Gemini Nano wraps output in ` ```json ``` ` fences | Strip with `.replace(/\`\`\`json|\`\`\`/g, '').trim()` before parsing |

---

## 5. Improvements NOT YET Built (High Priority)

These were identified from a Google I/O 2025 talk by Thomas Steiner (Chrome team) and should be implemented before the presentation. They make the extension significantly more robust and impressive.

### 5a. Replace fragile JSON prompt with `responseConstraint` (IMPORTANT)

The current approach asks the model to "please return JSON" which is fragile. The proper production pattern uses a JSON Schema passed as `responseConstraint` — Chrome guarantees the output matches the schema exactly, no stripping needed.

```js
// BEFORE (fragile - currently in the code)
const rawPoints = await session.prompt(`Return ONLY a JSON array...`);
const cleaned = rawPoints.replace(/```json|```/g, '').trim();
const keyPoints = JSON.parse(cleaned);

// AFTER (correct production pattern)
const schema = {
  type: "object",
  properties: {
    points: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5
    }
  },
  required: ["points"]
};

const session = await LanguageModel.create({
  systemPrompt: "You extract key points from text.",
  expectedInputLanguages: ["en"],
  expectedOutputLanguages: ["en"]
});

const result = await session.prompt(
  `Extract 3-5 key points from: ${pageText.slice(0, 2000)}`,
  { responseConstraint: schema }
);

// No cleanup needed — guaranteed valid JSON
const { points } = JSON.parse(result);
```

### 5b. Add streaming output (HIGH visual impact for demo)

Instead of showing a spinner then a wall of text, stream the summary word by word. This looks dramatically better in a live demo.

```js
// Replace the summarizer call with streaming version
const stream = await summarizer.summarizeStreaming(pageText);
const summaryEl = document.getElementById('summaryText');
summaryEl.textContent = '';

for await (const chunk of stream) {
  summaryEl.textContent = chunk; // Updates character by character
}
```

Same pattern works for Writer and Rewriter APIs.

### 5c. Add `expectedInputLanguages` and `sharedContext` to all API calls

Improves output quality. The Google I/O talk showed this as best practice:

```js
const summarizer = await Summarizer.create({
  type: 'tldr',
  length: 'short',
  expectedInputLanguages: ['en'],
  expectedOutputLanguages: ['en'],
  sharedContext: 'This is a webpage the user wants to understand quickly.'
});
```

### 5d. Optional: Add image description (multimodal — BIG wow moment)

The Prompt API now accepts images. A "describe this image" right-click context menu item would be the most impressive demo moment for senior devs. This is optional but very powerful:

```js
// session must declare image as expected input
const session = await LanguageModel.create({
  expectedInputLanguages: ["en"],
  expectedOutputLanguages: ["en"]
});

const altTextSchema = {
  type: "object",
  properties: {
    altText: { type: "string" },
    caption: { type: "string" }
  }
};

const result = await session.prompt([
  { type: "text", value: "Generate alt text and a caption for this image." },
  { type: "image", value: imageBlob }
], { responseConstraint: altTextSchema });

const { altText, caption } = JSON.parse(result);
```

---

## 6. Chrome Setup Requirements (Pre-talk checklist)

These must be done on the machine used for the presentation — Gemini Nano needs to be pre-downloaded.

**Step 1 — Enable the flags** (one-time, needs Chrome relaunch):
```
chrome://flags/#optimization-guide-on-device-model
→ Set to: "Enabled BypassPerfRequirement"

chrome://flags/#prompt-api-for-gemini-nano
→ Set to: "Enabled"
```

**Step 2 — Trigger model download:**
```
chrome://components
→ Find "Optimization Guide On Device Model"
→ Click "Check for update"
→ Wait for a version number to appear (not "Update available")
```

**Step 3 — Verify model is ready:**
```
chrome://on-device-internals → "Model Status" tab
→ Should show the model as available, not downloading
```

**Step 4 — Verify APIs are available in DevTools console:**
```js
await LanguageModel.availability()
// Must return "available" — anything else means model isn't ready
```

**Step 5 — Pre-open demo tabs** (so origin trials are warmed up):
- https://chrome.dev/web-ai-demos/prompt-api-playground/
- https://chrome.dev/web-ai-demos/summarization-api-playground/
- https://chrome.dev/web-ai-demos/ (all demos index)
- A long Wikipedia article (e.g. https://en.wikipedia.org/wiki/Nuclear_power)
- A foreign language page (e.g. a French or German news site)

**Important:** The model is ~2–3 GB. On a metered connection it won't auto-download. Must be on WiFi/ethernet. Verify the night before the talk, not the morning of.

---

## 7. The Learn and Share Presentation Plan

### Format
30+ minutes. Combination of slides + live demo. The extension is the centrepiece but the talk builds up to it with a cold open DevTools demo first.

### Minute-by-minute structure

**[0:00–2:00] Cold open — no slides**
Open Wikipedia (nuclear power article or similar). Open DevTools. Paste in console:
```js
const s = await Summarizer.create({ type: "tldr", length: "short", outputLanguage: "en" });
await s.summarize(document.body.innerText.slice(0, 4000));
```
Then switch to the Network tab. Zero requests. Let that sit.
Say: *"That was Gemini Nano running locally in this browser. No API key, no server, no per-token cost."*

**[2:00–5:00] One slide: the mental model shift**
One diagram: Old world (app → API key → OpenAI → costs money → privacy review). New world (app → browser API → local Gemini Nano → free → no data leaves).
Mention: Translator + LanguageDetector shipped stable in Chrome 138. Summarizer joined them. Prompt API in origin trial.

**[5:00–12:00] API whirlwind tour — DevTools live**
One-liner per API, fast pace. Each takes ~1 minute:
```js
// Translator
const t = await Translator.create({ sourceLanguage: "fr", targetLanguage: "en" });
await t.translate("Bonjour, comment ça va aujourd'hui?");

// LanguageDetector
const d = await LanguageDetector.create();
await d.detect("Bonjour, comment ça va?");

// Writer
const w = await Writer.create({ tone: "professional", length: "short" });
await w.write("A Slack message saying the deployment is done and everything looks healthy");

// Rewriter
const r = await Rewriter.create({ tone: "more-formal" });
await r.rewrite("hey can u check this pr when u get a chance its kinda urgent lol");

// Proofreader
await (await Proofreader.create()).proofread("Their going to the store to buy there groceries");
```

**[12:00–14:00] The responseConstraint reveal**
Show that you can pass a JSON Schema and get guaranteed structured output — no prompt engineering, no regex. This is the "seniors lean in" moment.

**[14:00–25:00] Live extension demo**
Open the Tab TL;DR extension on several pages:
- Long Wikipedia article → TL;DR + key points
- French or German news site → language detection banner + translate button
- GitHub README → structured key points

Walk through the code briefly — show how short it is. The point is: "this entire thing is 200 lines of vanilla JS."

**[25:00–28:00] The "so what" slide — practical use cases**
Frame it as: *"This isn't a replacement for cloud LLMs. It's a complement for things where you can't or shouldn't use the cloud."*
- Customer support drafts containing PII — no data to vendor
- Internal log triage / error summarisation — legal won't approve cloud LLMs for this
- i18n fallbacks on the client — free, instant
- Form autofill suggestions using user data
- Sentiment/content classification before data goes anywhere

**[28:00–30:00] Closer — three things to do today**
1. QR code → chrome.dev/web-ai-demos (playgrounds they can try in their browser right now)
2. GitHub link → Shehab's extension code
3. Forward-looking line: *"Firefox and Safari are watching this. If it becomes cross-browser, every web app gets free local AI for the cost of writing the feature flag."*

**[30:00+] Q&A**

### Slide count
Aim for 4–5 slides maximum. The talk lives in the terminal and the browser, not in slides. Suggested slides:
1. Old world vs new world diagram
2. API family overview (Summarizer, Translator, LanguageDetector, Writer, Rewriter, Proofreader, LanguageModel)
3. responseConstraint code example
4. Real-world companies using it in production (see below)
5. "So what" — practical use cases at EDF

### Real-world production examples (for credibility slide)
From the Google I/O talk by Thomas Steiner (Chrome team developer relations):
- **Drupal** — Summarizer API for SEO tag and description generation in their CMS editor
- **CyberAgent / Ameba** (major Japanese blogging platform) — Writer API for "suggest next sentence" feature, loved by power users
- **Yahoo Japan** — Prompt API with structured output for comment moderation at scale
- **Policybazaar** (large Indian insurance site) — Translator for dynamic regional language support (Hindi, Kannada etc.)
- **Cafe24** — Prompt API with structured output for AI-suggested product page tags

These are all production deployments. Having these on a slide answers the "is this toy or real?" question immediately.

---

## 8. Technical Deep Dives — Key Concepts to Understand

### How Chrome manages the model
- Gemini Nano is ~2–3 GB, downloaded once per machine via Chrome's component update system
- **Shared across all origins** — if one site downloads it, every site benefits
- Chrome manages updates, storage checks (removes model if disk < 10 GB free), and re-downloads
- Model does NOT run on mobile (as of Chrome 138) — desktop only (Windows 10/11, macOS 13+, Linux, ChromeOS)
- To check current model size: `chrome://on-device-internals`

### The `availability()` pattern
Always check before using any API:
```js
const status = await LanguageModel.availability();
// "available"     → ready immediately
// "downloadable"  → needs download first, trigger with create()
// "downloading"   → in progress, wait
// "unavailable"   → device not supported
```

### Hybrid inference (for production / the "what about mobile?" question)
Built-in AI only works on desktop. For production apps that need to work on mobile too, use Firebase AI Logic Hybrid SDK — it routes to local model when available and falls back to cloud automatically:
```js
const ai = getAI(firebaseApp, { 
  backend: new ChromeAIBackend(),
  inferenceMode: "prefer_on_device"  // falls back to cloud if unavailable
});
```
This answers the inevitable senior dev question: *"This is cool but you can't ship a feature that only works on some devices."* Hybrid inference is the answer.

### TypeScript types
```bash
npm install @types/dom-chromium-ai
```
Gives full TypeScript autocomplete for all built-in AI APIs.

---

## 9. Documentation Map

| Topic | URL |
|-------|-----|
| Built-in AI overview | https://developer.chrome.com/docs/ai |
| All built-in AI APIs (status table) | https://developer.chrome.com/docs/ai/built-in-apis |
| Getting started guide | https://developer.chrome.com/docs/ai/get-started |
| Prompt API (LanguageModel) | https://developer.chrome.com/docs/ai/prompt-api |
| Summarizer API | https://developer.chrome.com/docs/ai/summarizer-api |
| Translator API | https://developer.chrome.com/docs/ai/translator-api |
| Language Detector API | https://developer.chrome.com/docs/ai/language-detection |
| Writer API | https://developer.chrome.com/docs/ai/writer-api |
| Rewriter API | https://developer.chrome.com/docs/ai/rewriter-api |
| Proofreader API | https://developer.chrome.com/docs/ai/built-in-apis |
| Live demo playgrounds | https://chrome.dev/web-ai-demos/ |
| Prompt API playground | https://chrome.dev/web-ai-demos/prompt-api-playground/ |
| Summarizer playground | https://chrome.dev/web-ai-demos/summarization-api-playground/ |
| TypeScript types package | https://www.npmjs.com/package/@types/dom-chromium-ai |
| Chrome Extension getting started | https://developer.chrome.com/docs/extensions/get-started |
| Manifest V3 reference | https://developer.chrome.com/docs/extensions/reference/manifest |
| Side Panel API | https://developer.chrome.com/docs/extensions/reference/api/sidePanel |
| Scripting API | https://developer.chrome.com/docs/extensions/reference/api/scripting |
| Chrome AI Privacy article | https://www.progressiverobot.com/2026/05/09/chrome-ai-privacy/ |
| On-device internals debug page | chrome://on-device-internals |
| Components (trigger download) | chrome://components |

---

## 10. Key Gotchas and Pitfalls

1. **`outputLanguage` is now required** on Summarizer, Writer, Rewriter. Without it you get a warning and potentially degraded output. Always pass `outputLanguage: "en"`.

2. **Context window limit** — don't pass the full page text. Always `.slice(0, 4000)` for Summarizer, `.slice(0, 2000)` for Prompt API. The model will throw `QuotaExceededError` otherwise.

3. **Gemini Nano wraps JSON in markdown fences** even when you ask it not to. Always strip with `.replace(/```json|```/g, '').trim()` OR better, use `responseConstraint` (see improvement 5a above).

4. **The model must be pre-downloaded** — you cannot do this on the day of the talk. Do it at least the night before and verify via `chrome://on-device-internals`.

5. **`chrome://flags`** changes require a full Chrome relaunch, not just a tab reload.

6. **Developer mode** must be enabled in `chrome://extensions` to load unpacked extensions.

7. **To reload extension after code changes:** go to `chrome://extensions` and click the refresh icon on the extension card. No rebuild needed.

8. **Side panel persistence:** the side panel stays open when navigating between tabs but the content doesn't auto-refresh. The user has to click "Analyse this page" again on each new page. This is expected behaviour.

9. **`chrome.tabs.query`** inside the side panel requires the `activeTab` permission. Already in the manifest.

10. **The Prompt API is only stable for Chrome Extensions** (as of Chrome 138). For regular web pages it's still in origin trial. The extension approach is correct.

---

## 11. Immediate Next Steps for the Agent

In priority order:

### Priority 1 — Fix the JSON extraction (before anything else)
Replace the fragile string-replacement approach in `sidepanel.js` with `responseConstraint`. This is both a bug fix and a best practice demo for the talk. See section 5a above for the exact code.

### Priority 2 — Add streaming to the summary
Replace `summarizer.summarize()` with `summarizer.summarizeStreaming()` and stream chunks into the UI. This is the highest visual impact change for the demo. See section 5b above.

### Priority 3 — Add `expectedInputLanguages`, `expectedOutputLanguages`, and `sharedContext` to all API calls
Quick quality improvement. Apply to Summarizer, LanguageModel session creation, and any other API calls.

### Priority 4 — Polish the UI
The current CSS is functional but plain. Before the talk, make it look more polished:
- Add a tag-style badge showing the detected language
- Make the key points look like cards rather than plain `<li>` elements
- Add a subtle "Gemini Nano" branding note at the bottom
- Consider adding a "Copy summary" button

### Priority 5 — Test on multiple page types
Test against:
- A Wikipedia article (long, dense text)
- A GitHub README (technical, markdown source)
- A French or German news site (test language detection + translate flow)
- A short page (< 500 words) — make sure it handles this gracefully
- A page that fails (internal chrome:// pages can't be injected into) — improve the error message

### Priority 6 — (Optional) Add multimodal image description
Right-click context menu → "Describe this image" → uses Prompt API with image input → returns alt text + caption in a toast or appended to the side panel. This is the most impressive demo moment for senior devs. See section 5d above.

---

## 12. Presentation Tone and Framing Advice

- **Lead with the demo, not the slides.** The cold open DevTools demo is what hooks the room. Don't put up a title slide first.
- **The "no network" reveal is everything.** After the first demo, show the Network tab. Let the silence do the work. Don't rush past it.
- **Frame it as a complement, not a replacement.** Senior devs will push back with "but GPT-4 is better." The answer is: yes, for complex reasoning. But for bounded tasks with privacy or cost constraints, local is better.
- **The responseConstraint moment is for the seniors.** They will have all felt the pain of fragile JSON prompting. Showing that you can just pass a schema and get guaranteed structure will land well.
- **Have the extension code open in an editor during the demo.** Show how short it is. "This is ~200 lines of vanilla JavaScript. No framework, no bundler, no npm."
- **The production companies slide builds credibility.** Use it. Drupal, CyberAgent, Yahoo Japan, Policybazaar are not toy projects.
- **End with something actionable.** The QR code to chrome.dev/web-ai-demos means people can start playing in their own browser during the Q&A.

---

## 13. Related Topics Identified (Do NOT present these — for reference only)

These were researched and considered but not selected. Do not bring them into the presentation:

- **MCP (Model Context Protocol)** — RULED OUT. Colleague Eugenie already presented this to the same team in May 2025. Code at: `learn-and-share-mcp-may-2025/browser-tool-mcp/`.
- **PGlite** — Real Postgres in WASM in the browser. Strong alternative if built-in AI falls through.
- **Observability 2.0 / Wide Events** — Replacing the "three pillars" with arbitrarily wide structured events. Good conceptual talk, harder to demo visually.
- **Stagehand v3** — Hybrid AI browser automation. Best pick if the team has E2E test pain.
- **HTML in Canvas API** — Brand new Chrome API (origin trial May 2026) for rendering real interactive DOM elements inside WebGL/WebGPU scenes. Not relevant to this extension but genuinely interesting for senior frontend devs as a bonus "watch this space" mention.

---

## 14. Useful Demo Commands (Quick Reference for Preparation)

### Check model readiness
```js
await LanguageModel.availability()
// Expected: "available"
```

### Quick summarise test (paste into DevTools on any Wikipedia page)
```js
const s = await Summarizer.create({ type: "tldr", length: "short", outputLanguage: "en" });
console.log(await s.summarize(document.body.innerText.slice(0, 4000)));
```

### Quick translate test
```js
const t = await Translator.create({ sourceLanguage: "fr", targetLanguage: "en" });
console.log(await t.translate("La France est un pays magnifique."));
```

### Quick language detect test
```js
const d = await LanguageDetector.create();
console.log(await d.detect("Bonjour tout le monde"));
```

### Quick structured output test
```js
const schema = { type: "object", properties: { points: { type: "array", items: { type: "string" } } } };
const s = await LanguageModel.create({ systemPrompt: "Extract key points.", outputLanguage: "en" });
const r = await s.prompt("Summarise: The Eiffel Tower was built in 1889 for the World's Fair.", { responseConstraint: schema });
console.log(JSON.parse(r));
```

### Quick writer test
```js
const w = await Writer.create({ tone: "casual", length: "short", outputLanguage: "en" });
console.log(await w.write("A message to my manager saying I'm taking Friday off"));
```

---

*End of handover document. All code in section 3 is the current working state. All improvements in section 5 are not yet built. Start with Priority 1 (responseConstraint) as it fixes a real bug and is directly demonstrable in the talk.*
