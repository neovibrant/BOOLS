# BOOLS — Break Out Of Llm Slowness

A shareable, fully client-side Breakout demo where a **System One decision model** plays the paddle in real time.
The point it makes: a model that *returns a typed choice* instead of *generating text* is fast enough to play a game.

---

## 1. Concept

- **System One models** are a model category that TypeSafe AI introduced with **Jev** on 15 Sep 2026.
  - Input: a **state**, which is text or JSON describing the situation.
  - Input: one or more **typed questions**.
  - Output: typed answers with calibrated probabilities. The model never generates free text.
  - Question types:
    - `choice`: pick one option from a set.
    - `score`: a level on an ordered scale.
    - `noul`: the probability that a yes/no statement is true.
  - Typical latency is tens to hundreds of milliseconds, compared with seconds for LLMs.
- In BOOLS the model is asked one `choice` question per decision: **"Where will the ball cross the paddle row?"** Its answer is one of N horizontal zones.
- The game code (the paddle controller) moves the paddle toward the chosen zone. The model decides and the code acts. This is the "System One" reflex: no planning and no reasoning text.

## 2. Model & provider

- **Default model: `typesafe/jev-latest` via Requesty** (`https://router.requesty.ai/v1`). In our tests it was the fastest (~200 ms from Europe) and the only one that handled wall bounces reasonably from the raw state.
- `cloudflare/clef-flash`:
  - A 9B open-weights (Apache 2.0) decision model from Cloudflare, compatible with the Jev API. It also accepts images.
  - Price: about $0.09 per 1M input tokens. Output is free.
  - Cloudflare reports a model latency of about 39 ms median and 122 ms p95. Network time is extra.
  - Requesty lists it as **served from the US only**, so users outside the US pay the transatlantic round trip.
  - Requesty's decisions docs list `cloudflare/clef` but not `clef-flash` explicitly. The model page says it's the same kind of model. If it fails, the first test call will show the error.
- Other decision models on Requesty, usable by changing the model field:
  - `typesafe/jev-latest` (default): Requesty measured about 75 ms median for the latest week and 116 ms from the US. Expect about 220–240 ms from Europe or Asia Pacific, because Jev is hosted only on the US West Coast.
  - `cloudflare/clef`: 27B, about 209 ms median by Cloudflare's own figures.
  - `perplexity/pplx-decider-v1-27b`: no published latency.
- Other places to find decision models, which users can enter themselves:
  - OpenRouter (Jev 1.13 and 1.14).
  - Cloudflare Workers AI (Clef).
  - Liquid d1 (free tier).
  - The OpenAI Decisions API (`gpt-6-luna`). Note that it uses a different format.
- Self-hostable open alternatives were considered and are **not used** in this demo:
  - Laya (`@receptron/laya`, runs in Node through ONNX).
  - Liquid d1-3B, Kev, Clef-flash weights, and others.
  - Full list: github.com/yanng981/awesome-system-one

## 3. Architecture

- **No backend.** The whole app is static client-side HTML/JS, hosted as **static assets on a Cloudflare Worker**.
- The browser calls the provider API **directly** with the **user's own** URL, API key and model.
- This means the game, the code and the link can all be shared freely, because nobody's key is embedded.
- **Requesty allows direct browser calls (CORS).** This was verified with a preflight request to `/v1/chat/completions`, which returned:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: POST`
  - `Access-Control-Allow-Headers: authorization,content-type`

### Files

```
public/index.html             # the entire app: setup form, game, API client (plain JS, no build step)
wrangler.jsonc                # static-assets Worker config
.github/workflows/deploy.yml  # manual deploy (Actions → Deploy → Run workflow)
instructions.md               # this document
```

`wrangler.jsonc`:

```jsonc
{
  "name": "bools",
  "compatibility_date": "2026-10-25",
  "assets": { "directory": "./public" },
  "routes": [{ "pattern": "bools.iteratory.com", "custom_domain": true }]
}
```

- **Deploy:** manual only. Run the GitHub Action from **Actions → Deploy → Run workflow**; it runs `wrangler deploy`. Pushes don't deploy.
  - It needs two secrets in the GitHub environment `prod`: `CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers template, limited to the account and the `iteratory.com` zone) and `CLOUDFLARE_ACCOUNT_ID`.
- The site is served at `https://bools.iteratory.com` and at `bools.<account>.workers.dev`. Wrangler creates the DNS record and certificate.
- To run locally, run `npx wrangler dev` or open `public/index.html` from any static server.
- There are no npm dependencies.

## 4. Setup screen

The setup screen is shown first. **The game stays hidden until a test call succeeds.**

| Field | Default | Notes |
|---|---|---|
| **API URL** | `https://router.requesty.ai/v1` | Base URL. Must start with `https://` or `http://`. Requesty or any compatible provider. |
| **API key** | (empty) | Password field with a **Show** toggle. `autocomplete="off"`. |
| **Model** | `typesafe/jev-latest` | Needed because every request names a model, and model IDs differ between providers. |
| **Style** | OpenAI-compatible | Dropdown, described below. |

**Style options:**
1. **OpenAI-compatible (Requesty, etc.)**: enabled and the default.
2. **System One (Jev native)**: shown but **disabled** for now. We will come back to it (section 6.2).

**Behavior:**
- Settings are saved in **`localStorage`** under one key, e.g. `bools.config`, as `{url, key, model, style}`.
- On load, saved settings pre-fill the form and are shown on the page. The key is masked unless **Show** is on.
- **Play** saves the settings, makes **one test decision call**, then either starts the game or shows the provider's error inline.
- **Forget** clears `localStorage` and empties the form.
- From the game screen you can get back to setup to change the model or provider mid-session.

**Notice shown on the form:**
> Your key is stored in this browser's localStorage and sent only to the URL above, never to this site. Anyone with access to this browser, or any script running on this page, could read it. Use a spending-limited key.

## 5. Game

- Classic Breakout on a `<canvas>`, using a `requestAnimationFrame` loop at about 60 fps.
- The playfield is **480 px wide**, with a paddle, ball, bricks, score and lives.
- **There is no keyboard or mouse control of the paddle.** The model plays.
- **Ball speed is tuned for network latency.** The ball must be slow enough that a decision arriving 100–300 ms late can still be reached. Speed should be a single constant that is easy to tweak.
- **Zones:** the paddle row is split into **8 zones of 60 px** (`z0` to `z7`).

### Decision loop

- **Only one request is in flight at a time.**
  - As soon as an answer arrives, the next request is sent with the current state.
  - The rate is therefore set by latency: about 3–10 decisions per second.
- **Requests are sent only while the ball is falling.** Answers that arrive after the ball has turned around are ignored.
- **Between answers, the paddle keeps sliding** toward its aim at a fixed paddle speed. The aim is the probability-weighted centre of the chosen zone and its two neighbours, so when the model is torn between neighbouring zones the paddle sits between them.
- **The game never predicts the ball itself.** All paddle movement comes from the model.
- **On error** (network, HTTP status, bad JSON, or a missing answer):
  - The paddle holds its last target.
  - The error is shown in the HUD.
  - The loop waits 1 s, or the `Retry-After` value, before retrying.
- The loop pauses while the tab is hidden and after game over.
  - Nothing crashes.

### HUD (on-screen stats)

- Model, endpoint, and loop status (request in flight, waiting, backing off, paused).
- Decisions, and decisions per second while the ball falls.
- Latency: last, average, p50/p95, min/max.
- Time to spare (from the last answer to the ball crossing), and answers that came too late.
- Last answer with its confidence, and a probability bar for each zone.
- **Accuracy, graded after the fact:** when the ball crosses the paddle row, every answer from that descent is compared with the real crossing zone.
  - Shown as exact and ±1 zone, overall and by distance (near, mid, far).
  - Also shown: how often the aim was within paddle reach.
  - The real zone's bar turns green.
- Hits and misses, score and lives, tokens, errors and the last error.
- The last 12 decisions.

## 6. API formats

### 6.1 OpenAI-compatible style (enabled)

The request follows Requesty's decision-model convention: the normal Chat Completions endpoint, with the questions passed in `response_format`.

`POST {url}/chat/completions`

Headers: `Authorization: Bearer {key}`, `Content-Type: application/json`

```json
{
  "model": "typesafe/jev-latest",
  "messages": [
    { "role": "user",
      "content": "{\"ball\":{\"x\":312,\"y\":140,\"vx\":90,\"vy\":120},\"paddle\":{\"x\":200,\"y\":440,\"width\":70},\"field\":{\"width\":480,\"height\":480}}" }
  ],
  "response_format": {
    "type": "questions",
    "questions": {
      "zone": {
        "type": "choice",
        "instructions": "Ball x,y is its center, velocities are px per second, y grows downward. Where will the ball cross the paddle row (y = paddle.y)? Account for bounces off the left (x=0) and right (x=field.width) walls.",
        "criteria": {
          "z0": "x 0-60", "z1": "x 60-120", "z2": "x 120-180", "z3": "x 180-240",
          "z4": "x 240-300", "z5": "x 300-360", "z6": "x 360-420", "z7": "x 420-480"
        }
      }
    }
  }
}
```

The response puts the answers in `choices[0].message.content` as a **JSON string**:

```json
{"zone":{"type":"choice","choice":"z6","confidence":0.8,"probabilities":{"z0":0.0,"z1":0.0,"...":0.0,"z6":0.8,"z7":0.2}}}
```

Rules from Requesty's docs:
- **Only `user` messages** are allowed. System, assistant and tool messages are rejected with a 400.
- **No streaming.** `stream: true` returns a 400.
- `response_format.type` **must** be `questions`. A plain chat call to a decision model fails.
- Images (Clef only): up to 4 per request, sent as base64 `data:` URLs. Remote image URLs are rejected.
- A 429 means rate limited. Respect `Retry-After`.

### 6.2 System One style (disabled; next step)

This is Jev's native format. Implement it later as a second request-builder and answer-reader pair behind the same dropdown. Nothing else changes.

`POST {url}/systemone`. The TypeSafe reference is `https://api.typesafe.ai/v1/systemone`.

Headers: `Authorization: Bearer {key}`, `Content-Type: application/json`

```json
{
  "model": "jev-latest",
  "state": { "ball": {"x":312,"y":140,"vx":90,"vy":120}, "paddle": {"x":200,"y":440,"width":70}, "field": {"width":480,"height":480} },
  "questions": { "zone": { "type": "choice", "instructions": "...", "criteria": { "z0": "x 0-60", "...": "..." } } }
}
```

The response is plain JSON, with no message wrapper:

```json
{ "model": "jev-1.14.0", "answers": { "zone": { "type": "choice", "choice": "z6", "confidence": 0.8, "probabilities": { "...": 0 } } }, "usage": { "input_tokens": 300, "output_tokens": 0 } }
```

**To verify before enabling:**
- Does TypeSafe's API allow direct browser calls (CORS)?
- What is the exact path of Requesty's "Create System One Decision" endpoint?
- Other servers that speak this format include Laya, Kev, Clef on Workers AI, and Liquid's `/decisions/v1/systemone`.

## 7. Code shape (inside `index.html`)

Keep it minimal. There is no framework and no build step.

- `loadConfig()` / `saveConfig()` / `clearConfig()`: `localStorage` helpers.
- `buildRequest(style, cfg, state)`: returns `{url, init}` for `fetch`.
- `readAnswer(style, json)`: returns `{choice, confidence, probabilities}` or throws.
- `decide(state)`: `fetch` with a timeout through `AbortController`. It times the call and updates the HUD.
- `step()` / `draw()`: game physics and rendering.
- **Self-check:** opening `index.html?test` runs `console.assert` checks on `buildRequest` and `readAnswer` against the sample payloads above, and prints PASS or FAIL. There is no test framework.

## 8. Cost

- One decision is about 300 input tokens.
- At 5 decisions per second that is about 5.4M tokens per hour. That costs about **$0.49 per hour** on clef-flash or about **$0.23 per hour** on Jev.
- Output tokens are free on all of these models.

## 9. Security & privacy

- The key lives only in the user's `localStorage` and in the requests the user's browser sends to the URL they entered. The Worker never sees it.
- Show the notice from section 4 and recommend a spending-limited key.
- Validate the URL scheme. Never `eval` or insert provider responses as HTML; render them with `textContent`.
- If the user's provider doesn't allow cross-origin calls, the test call fails with a clear message: "provider blocks browser calls (CORS)".

## 10. Deliberately skipped (add later)

| Skipped | Add when |
|---|---|
| System One (Jev native) style | Next step. It is already in the dropdown, disabled. |
| Screenshot input (canvas → base64 PNG → Clef or Jev 1.14 images) | Showing the model playing "from pixels". |
| A second question, e.g. a `noul` for "is the ball approaching?" | If the zone answers alone look jittery. |
| Side-by-side race of two models | If a speed comparison becomes the demo's focus. |
| Self-hosted local model (Laya or d1-3B) | For an offline or zero-cost version. |
| Any backend or proxy | Only if a provider blocks CORS that we really want to support. |

## 11. Name

**BOOLS — Break Out Of Llm Slowness.** It's an acronym and also a nod to booleans and typed answers.

Alternatives considered: "Thinking, Fast and Breakout", "Keep Calm and Break Out", "Paddle Without Prattle", "Zero Shot, All Bricks", "BLINK".
