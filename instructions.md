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
- `typesafe/jev-latest` (default): Requesty measured about 75 ms median for the latest week and 116 ms from the US. Expect about 220–240 ms from Europe or Asia Pacific, because Jev is hosted only on the US West Coast. `jev-latest` is not in Requesty's model list but works, probably as an alias for the newest Jev.
- `cloudflare/clef`: 27B, about 209 ms median by Cloudflare's own figures.
- **Decision models on Requesty** (from the public `GET /v1/models`, Oct 2026; output is free on all). These are offered as suggestions in the Model field:

  | Model | $/1M in | Region | Images | Open weights |
  |---|---|---|---|---|
  | `typesafe/jev-1.14.0`, `typesafe/jev-1.13.0` | 0.042 | global | – | – |
  | `cloudflare/clef-flash` (9B) | 0.09 | global | ✓ | ✓ |
  | `cloudflare/clef` (27B) | 0.24 | global | ✓ | ✓ |
  | `melious/clef-flash`, `melious/clef` | 0.09 / 0.24 | EU | – | ✓ |
  | `sference/clef` | 0.24 | EU | ✓ | ✓ |
  | `perplexity/pplx-decider-v1-27b` | 0.04 | global | – | – |
  | `azure/decision-1` (Microsoft, 9B) | 0.042 | US | – | – |
  | `azure/decision-1@francecentral`, `@swedencentral` | 0.042 | EU | – | – |

  Only Jev, clef-flash and clef have been tested in BOOLS so far.

### Test results (Oct 2026, from Europe via Requesty)

12 random falling-ball states per model, raw state only:

| Model | Exact zone | Aim within paddle reach | Latency |
|---|---|---|---|
| clef-flash | 2/12 | 4/12 | ~700 ms |
| clef | 3/12 | 5/12 | ~650 ms |
| jev-latest | 8–9/12 | 8/12 | ~200–390 ms |

- None of them reliably works out wall bounces. Jev is clearly the best.
- In a live game, clef-flash was about 53% exact, p50 412 ms, p95 1.25 s. Jev plays noticeably better.
- When the exact crossing x was given to the model, every model scored 12/12. That makes the task trivial, so it was dropped: the game sends only the raw state.
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
- **One-time setup** (values never go in the repo):
  1. Cloudflare API token: *Edit Cloudflare Workers* template, limited to the account and the `iteratory.com` zone.
  2. GitHub → Settings → Environments → `prod`, limited to branch `main`, with secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the 32-character ID in the dashboard URL).
  3. No Worker has to be created by hand; the first deploy creates it. Don't also connect the repo in the Cloudflare dashboard, or deploys run twice.
- The workflow pins `wranglerVersion: "4"`. The action's default (3.x) fails with "Missing entry-point" on an assets-only Worker.
- The site is served at `https://bools.iteratory.com` and at `bools.<account>.workers.dev`. Wrangler creates the DNS record and certificate.
- To run locally, run `npx wrangler dev` or open `public/index.html` from any static server.
- There are no npm dependencies.

## 4. Setup screen

The setup screen is shown first. **The game stays hidden until a test call succeeds.**

| Field | Default | Notes |
|---|---|---|
| **API URL** | `https://router.requesty.ai/v1` | Base URL. Must start with `https://` or `http://`. Requesty or any compatible provider. |
| **API key** | (empty) | Password field with a **Show** toggle. `autocomplete="off"`. |
| **Model** | `typesafe/jev-latest` | Free text. When the URL is Requesty's, it suggests the decision models from section 2 (`<datalist>`). |
| **Style** | OpenAI-compatible | Dropdown, described below. |

**Style options:**
1. **OpenAI-compatible (Requesty, etc.)**: enabled and the default.
2. **System One native**: `POST {url}/systemone` (section 6.2). On Requesty, use `typesafe/jev-1.14.0` rather than the `jev-latest` alias; the form switches it automatically.

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
- **Ball speed is tuned for network latency:** `BALL_SPEED = 180` px/s, `PADDLE_SPEED = 360` px/s. Paddle 70 px wide at y = 440.
- **Zones:** the paddle row is split into **8 zones of 60 px** (`z0` to `z7`).

### Decision loop

- **Only one request is in flight at a time.**
  - As soon as an answer arrives, the next request is sent with the current state.
  - The rate is therefore set by latency: about 2–5 decisions per second.
- **Requests are sent only while the ball is falling.** Answers that arrive after the ball has turned around are ignored.
- **Between answers, the paddle keeps sliding** toward its aim at a fixed paddle speed. The aim is the probability-weighted centre of the chosen zone and its two neighbours, so when the model is torn between neighbouring zones the paddle sits between them.
- **The game never predicts the ball itself.** All paddle movement comes from the model.
- **On error** (network, HTTP status, bad JSON, or a missing answer):
  - The paddle holds its last target.
  - The error is shown in the HUD.
  - The loop waits 1 s, or the `Retry-After` value, before retrying.
  - Nothing crashes.
- The loop pauses while the tab is hidden and after game over.

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
### Music

The same model composes the soundtrack, live, as you play. It's a second showcase: one call answers 24–48 typed questions, one per melody note.

**Styles** (dropdown on the settings screen and under the game, saved in `bools.config` as `music`). Every style loops in exactly **20 s**:

| Style | Key, chords | Tempo, bars, notes | Sound |
|---|---|---|---|
| 🎮 Arcade chiptune (default) | A minor: Am F C G | 144 BPM, 12 bars, 48 notes | square lead, octave-bouncing triangle bass, steady beat |
| 🌆 Synthwave chase | E minor: Em C G D | 96 BPM, 8 bars, 32 notes | sawtooth lead, pulsing saw bass, four-on-the-floor kick |
| 🕯️ Dungeon crawl | D harmonic minor: Dm Bb Gm A Dm A | 72 BPM, 6 bars, 24 notes | long triangle lead, held bass, sparse kick and hat |
| 🔥 Boss battle | E phrygian: Em Em F Em | 120 BPM, 10 bars, 40 notes | short square stabs, pulsing bass, double kick, constant hats |
| 🔇 No music | | | no calls, audio suspended |

**One call = one track.**
- The request has one `choice` question per beat (`n00`, `n01`, …). The options are 8 notes from the style's scale plus `rest`.
- Each question's instructions give the bar, the beat, the chord and its tones, plus the style's mood (e.g. "eerie, use rests, half steps and the dark C#"). The last bar is told to end on the tonic.
- The state is `{music, key, tempo_bpm, bars, chords, event, track, score, lives}`.

**Each note is sampled from the model's probabilities, not just its top choice.** The model returns nearly the same top choices for the same prompt, so without sampling every track would sound the same.

**The browser plays it with Web Audio** (no library). The model writes only the melody. Bass and drums are fixed patterns per style that follow the chords.

**When it composes:**
- **On the settings screen, music starts as soon as it can:** a music style is selected and the form has a valid URL, a key and a model. With settings saved in `localStorage`, it composes as soon as the page opens.
  - Browsers block sound until the first click or key press. Until then the status line says "Click anywhere to hear it."
- **During play, the track loops with no further calls.** A new track is composed only on:
  - game start, or Play again
  - a lost life
  - the next level (all bricks cleared)
  - **⏭ Next track**
  - changing the style
- **At most one composition is in flight.** Triggers that arrive meanwhile are ignored. A style change made during composing is honoured once the current composition finishes.
- **The new track takes over at the next bar line**, so the beat never breaks.
- **On error, the current track keeps playing** and the error shows in the status line.
- **Audio pauses** when the tab is hidden and on game over. Choosing **No music** suspends it and makes no calls.

**Making it obvious the model composes:** the music box is labelled "Soundtrack, composed live by your model". It shows:
- a live status, e.g. "✎ typesafe/jev-latest is composing a new boss battle track (lost life)… 180 ms", then "♪ Track #3, composed live by …: 40 notes in 232 ms, 8,300 tokens. Loops every 20 s with no new calls."
- the track's notes, with the one playing now highlighted

The same controls (one set of DOM elements) move between the settings screen and the game screen.

**Measured on Jev via Requesty:** 230–400 ms per track. Tokens per track:
- 24 notes: about 5,000
- 32 notes: about 6,700
- 48 notes: about 10,000 (≈ $0.0004)

Tracks are composed only on the events above, so music costs far less than the paddle.

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

### 6.2 System One native style (enabled)

This is Jev's native format, the second option in the **API style** dropdown. It uses the same questions, state, aiming and music as the OpenAI-compatible style. Only the request wrapper and the answer location differ.

`POST {url}/systemone`. With Requesty that's `https://router.requesty.ai/v1/systemone`. TypeSafe's own endpoint is `https://api.typesafe.ai/v1/systemone`.

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

**Verified (Oct 2026):**
- **Requesty's `/v1/systemone` works from the browser.** Its preflight returns `Access-Control-Allow-Origin: *`. Tested end to end in the browser: paddle p50 225 ms, about 580 tokens per decision, and 48-note music tracks in about 300 ms.
- **Requesty's `/systemone` rejects the `typesafe/jev-latest` alias** (404 "model not found"). It accepts `typesafe/jev-1.14.0`. Picking the native style while the model is `typesafe/jev-latest` switches the model to `typesafe/jev-1.14.0`. Other Requesty models (e.g. `cloudflare/clef-flash`) work with their usual IDs.
- **The native style uses more tokens than OpenAI-compatible:** Jev on `/systemone` reported about 550 input tokens per decision, against about 400, plus some output tokens. Output tokens are free.
- **TypeSafe's own API (`api.typesafe.ai`) blocks browser calls.** Its preflight returns 400 with no CORS headers, so it can't be used from BOOLS without a proxy. Use Requesty, or another provider that allows CORS.
- Other servers that speak this format, untested: Ollama, LM Studio, LLM Gateway, Abacus RouteLLM, and Liquid's `/decisions/v1/systemone`.

## 7. Code shape (inside `index.html`)

Keep it minimal. There is no framework and no build step.

- `loadConfig()` / `saveConfig()` / `clearConfig()`: `localStorage` helpers.
- `buildRequest(style, cfg, state)`: returns `{url, init}` for `fetch`.
- `readAnswer(style, json)`: returns `{choice, confidence, probabilities}` or throws.
- `decide(state)`: `fetch` with a timeout through `AbortController`. It times the call and updates the HUD.
- `makeState()`: the rounded state that is sent. Ball, paddle and field only, nothing precomputed.
- `aimX(answer)`: the paddle target, weighted over the chosen zone and its neighbours.
- `record()` / `score(x)`: speed stats when an answer arrives; accuracy when the ball crosses the paddle row.
- `step()` / `draw()`: game physics and rendering.
- `ask(state, questions, timeout)`: the shared request; `decide()` (paddle) and `requestTrack()` (music) both use it.
- `MUSIC_STYLES`: one entry per style (tempo, bars, scale, chords, mood, sounds, drum pattern). Add a style here and as a dropdown option.
- `requestTrack(reason)` / `pickNote()`: compose a track and sample each note. `musicTick()` / `playStep()`: the Web Audio scheduler, which queues about 200 ms ahead.
- `apiCfg()` / `autoMusic()`: music before Play, using the form's values when they're complete.
- **Self-check:** opening `index.html?test` runs `console.assert` checks on requests, answers, aiming and grading. It also checks that each style loops in 20 s and has every chord defined, the music requests, the dropdown and note sampling. It prints PASS or FAIL. There is no test framework.
- **Local testing:** if you use a static server, turn caching off (e.g. `npx http-server public -c-1`), or the browser keeps running old code.

## 8. Cost

- One decision is about 370–400 input tokens (measured).
- Requests go out only while the ball falls, at 2–5 per second, so roughly 2–4M tokens per hour of play. That's about **$0.10–0.20 per hour** on Jev, or **$0.20–0.35 per hour** on clef-flash.
- Output tokens are free on all of these models.
- Music: 5,000–10,000 input tokens per 20 s track (≈ $0.0002–0.0004 on Jev), only on the triggers listed in section 5. Music on the settings screen composes one track and loops it.

## 9. Security & privacy

- The key lives only in the user's `localStorage` and in the requests the user's browser sends to the URL they entered. The Worker never sees it.
- Show the notice from section 4 and recommend a spending-limited key.
- Validate the URL scheme. Never `eval` or insert provider responses as HTML; render them with `textContent`.
- If the user's provider doesn't allow cross-origin calls, the test call fails with a clear message: "provider blocks browser calls (CORS)".

## 10. Deliberately skipped (add later)

| Skipped | Add when |
|---|---|
| Screenshot input (canvas → base64 PNG → Clef or Jev 1.14 images) | Showing the model playing "from pixels". |
| A second question, e.g. a `noul` for "is the ball approaching?" | If the zone answers alone look jittery. |
| Side-by-side race of two models | If a speed comparison becomes the demo's focus. |
| Self-hosted local model (Laya or d1-3B) | For an offline or zero-cost version. |
| Any backend or proxy | Only if a provider blocks CORS that we really want to support. |
| Fetching the Requesty model list live (the suggestions are hard-coded) | If Requesty adds decision models often. |
| A committed script to benchmark models on fixed states | When comparing the untested models (Azure Decision-1, EU-hosted Clef, Perplexity). |

## 11. Name

**BOOLS — Break Out Of Llm Slowness.** It's an acronym and also a nod to booleans and typed answers.

Alternatives considered: "Thinking, Fast and Breakout", "Keep Calm and Break Out", "Paddle Without Prattle", "Zero Shot, All Bricks", "BLINK".
