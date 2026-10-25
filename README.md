# BOOLS — Break Out Of Llm Slowness

A Breakout game played live by a **System One decision model**: a model that answers a typed question with calibrated probabilities instead of generating text. That makes it fast enough to steer a paddle.

**Play: https://bools.iteratory.com**

## How it works

- While the ball falls, the game sends its state (ball position and velocity, paddle, field) and one `choice` question: *"Where will the ball cross the paddle row?"*, with 8 zones as options.
- The model returns a zone plus a probability per zone. The paddle slides toward it. Then the next question goes out.
- The game never predicts the ball itself. All movement comes from the model.
- **The model also composes the soundtrack, live.** Pick a style: 🎮 Arcade chiptune, 🌆 Synthwave chase, 🕯️ Dungeon crawl, 🔥 Boss battle, or 🔇 No music.
  - One call with one typed question per note (24–48 notes) writes a 20-second melody. The browser plays it on repeat with no further calls.
  - A new track is composed on a new game, a lost life, the next level, a style change, or **⏭ Next track**.
  - Music starts on the settings screen as soon as the URL, key and model are filled in.

## Play

1. Get an API key from [Requesty](https://requesty.ai), ideally with a spending limit.
2. Open the site, paste the key, press **Play**. The default model is `typesafe/jev-latest`. The Model field suggests Requesty's other decision models, or you can type any OpenAI-compatible decision-model endpoint and model.

The key stays in your browser's `localStorage` and is sent only to the API URL you enter. There is no backend.

Cost: about 400 input tokens per decision, a few decisions per second while the ball falls. A music track is 5,000–10,000 tokens, once per track. Output is free.

## Stats on screen

- **Latency:** last, average, p50/p95, and how much time was left before the ball reached the paddle.
- **Accuracy:** graded only after the ball actually crosses the paddle row. Shown as exact and ±1 zone, by distance (near, mid, far).
- **Answers:** probabilities for each zone, and the last 12 decisions.

## Develop

- Everything is in `public/index.html`: plain JS, no build step, no dependencies.
- Run locally with `npx wrangler dev`, or any static server.
- Open `index.html?test` for the self-check. It prints PASS or FAIL in the console.
- Deploy by hand: GitHub → **Actions → Deploy → Run workflow** (`.github/workflows/deploy.yml`). It needs the GitHub environment `prod` with secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Full design notes: [instructions.md](instructions.md).
