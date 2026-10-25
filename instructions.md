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
- 12 states turned out to be too few: Jev's 8–9/12 was luck. On 60 states it's about one in three exact (see "Prompt tuning" below).
- In a live game, clef-flash was about 53% exact, p50 412 ms, p95 1.25 s. Jev plays noticeably better.
- When the exact crossing x was given to the model, every model scored 12/12. That makes the task trivial, so it was dropped: the game sends only the raw state.

### Prompt tuning (Oct 2026, Jev via Requesty)

**Rule:** the game may add facts and clearer questions, but never pre-computed hints (slope, time to impact, predicted crossing).

**Method:** a local benchmark script (not committed) ran 60 seeded falling-ball states per prompt version.
- Truth was computed only inside the script.
- It used the same paddle aiming as the game, and reports exact zone, ±1 zone, and aim within paddle reach.
- Run-to-run noise was about ±3 points.
- Two sets of states: **all heights** (ball 30–280 px above the paddle, half needing a wall bounce), and **near** (20–120 px above). The near set matters most, because the last answer before a catch is asked there.

| Version | Change | All: exact / reach | Near: exact / reach | Tokens |
|---|---|---|---|---|
| v0 | original prompt | 30–33% / 40–43% | 38–40% / 55–60% | 554 |
| v1 | ball radius + real bounce limits (x 6 and 474) | 38% / 48% | 40–42% / 60% | 583 |
| v2 | last 3 ball positions | 32% / 45% | | 618 |
| v3 | state as a sentence instead of JSON | 32% / 42% | | 545 |
| v4 | zone labels ("far left…") | 32% / 42% | | 582 |
| v5 | two worked examples (one bounce, one straight) | 37% / 45% | | 691 |
| v6 | extra "which wall first?" question | 35% / 43% | | 646 |
| v7 | mirror rule spelled out ("don't pick z0/z7 just because it's heading there") | 38% / 45% | | 642 |
| v8 | mirrored ranges inside each zone label | 32% / 43% | | 975 |
| v9 | v1 + v5 + v7 | 32–37% / 40–50% | 42–45% / 60–68% | 808 |
| **v10** | **v9 with the catch line made exact (in use)** | **42% / 48–50%** | **43–45% / 62–63%** | **860** |

**Findings:**
- **Jev's main mistake is choosing the wall the ball is heading toward.** It picked z0 or z7 about 43 times in 60 when the truth was z0 or z7 only 18 times. It reads direction well but not distance or the bounce.
- **Its confidence barely separates right from wrong:** 0.21 on right answers against 0.16 on wrong ones.
- **Only v9 helped beyond noise, and only close to the paddle:** reach went from 55–60% to 65%, and ±1 accuracy from 75–77% to 87%. Since the last answer near the paddle decides each catch, that's the one that matters, so v9 is the prompt in use. It costs about 46% more tokens per decision.
- **v10 fixes a 6 px mismatch.** v9 asked where the ball crosses "the paddle row (y = paddle.y)", i.e. y = 440, but the game decides a catch when the ball's bottom touches the paddle top, so its centre is at y = 434. v10 says this explicitly, sends `paddle.catch_y: 434`, and its mirror rule and examples use the real bounce limits (6 and 474). v10 ties v9 near the paddle and is clearly better over all heights (42% exact against 32–33%, in two runs each), so it's the prompt in use.
- **Live check with v9** (Jev, about 2.5 minutes): 14 hits and 4 misses; 49% exact and 89% within ±1 zone overall; near the paddle, 13 of 24 exact and 22 of 24 within ±1; p50 236 ms.
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
- **On the playfield:**
  - The zone strip and its labels sit just above a dashed **catch line** at y = 434, where every catch or miss is decided. They used to be at the canvas bottom, where a missed ball keeps drifting sideways and gives a misleading picture.
  - The model's chosen zone is shaded blue.
  - After each crossing, the zone where the ball actually crossed gets a green outline, and a green marker shows the exact x. Both fade out over 2 s. They're drawn only after the crossing, so the game still predicts nothing.
- Hits and misses, score and lives, tokens, errors and the last error.
- The last 12 decisions.
### Coach (System 2 teaching System 1)

- **Use a coach** checkbox on the settings screen. It's unchecked by default; checking it expands:
  - **Coach API URL** and **Coach API key**. If they're empty, the coach uses the main URL and key.
  - **Coach model**: a normal chat LLM, required, with no suggestions.
  - **Custom header name and value** (optional): an extra auth header sent only to the coach. The server must allow it in `Access-Control-Allow-Headers`. A hosted page calling `localhost` may also need `Access-Control-Allow-Private-Network: true`.
  - The coach always uses the OpenAI-compatible `/chat/completions` format.
- **Every fall is recorded** in `bools.prompts.descents`:
  - The play context: score, lives, bricks left and the paddle x at the start.
  - Every decision: ball x, y, vx, vy, the paddle x when asked, the choice and the confidence, each tagged with its prompt version.
  - The crossing x, the paddle x at the crossing, and whether it was caught or missed.
- **The coach is called on every miss, and the next ball waits for it.** The canvas shows "Coach is rewriting the prompt…", and the ball relaunches 1 s after the coach answers or fails. So every ball is played by the latest prompt. The game has 5 lives.
- History is kept across games and reloads, so each call sees every game played in this browser since the last reset. It gets the physics rules, the answer latency and paddle speed, and every version with its totals, reason and full fall history. It's told that a miss can come from a late answer or a paddle too far away, not only from a wrong zone. It replies with `{base, instructions, why}`:
  - It can build a new version on any earlier version.
  - Or it can return empty instructions to switch back to `base` unchanged.
- **Only the question's `instructions` change.** The zones and the state stay fixed, so the no-hints rule holds. Prompts are capped at 1,500 characters.
- **Each answer is graded against the version that produced it.**
- **The HUD shows:**
  - The prompt in use.
  - An **All prompt versions** section, collapsed by default, with the newest first. Each version shows when it was created, its parent, its accuracy, the coach's reason and its full text.
  - The coach's last result: wrote a new version, switched back, or failed.
- Versions and history are saved in `localStorage` under `bools.prompts`. That's about 5 MB, roughly 5 hours of play. When it's full, the oldest 10% of falls are dropped and the HUD says so. **Reset to original prompt** clears versions and history.
- **Cost:** the whole history is sent on every miss, so each coach call grows over time. That's roughly 25 tokens per decision stored, or about 100k tokens after an hour of play.
- The point is the story and showing the limits of System One: small n is noisy, and the coach may not beat v0.

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
      "content": "{\"ball\":{\"x\":312,\"y\":140,\"vx\":90,\"vy\":120,\"radius\":6},\"paddle\":{\"x\":200,\"y\":440,\"width\":70,\"catch_y\":434},\"field\":{\"width\":480,\"height\":480},\"walls\":{\"left_bounce_x\":6,\"right_bounce_x\":474}}" }
  ],
  "response_format": {
    "type": "questions",
    "questions": {
      "zone": {
        "type": "choice",
        "instructions": "Ball x,y is its center (radius 6), velocities are px per second, y grows downward. The paddle top is at y=440, so the ball is caught or missed when its center reaches y=434 (paddle.catch_y). Where will the ball center be when it reaches y=434? The center bounces off the walls at x=6 and x=474 (angle in = angle out). The ball never leaves the field: … [mirror rule] … Example: … [one bounce and one straight example]",
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
- `QUESTION`: the paddle prompt (v10, see "Prompt tuning" in section 2). The full text is in the code.
- `CATCH_Y` (434): the ball-centre y where a catch or miss is decided. The prompt, the state (`paddle.catch_y`), the game's crossing check and the drawing all use it.
- `makeState()`: the rounded state that is sent: ball (with radius), paddle (with `catch_y`), field and wall bounce limits. Facts only, nothing pre-computed.
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

- One decision is about 860 input tokens with the v10 prompt (measured on Jev; it was about 550 with the original prompt).
- Requests go out only while the ball falls, at 2–5 per second, so roughly 4–7M tokens per hour of play. That's about **$0.15–0.30 per hour** on Jev.
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
