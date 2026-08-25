# Calm Voice Power — project context handoff

A portable brief for continuing work on this project in another AI tool.
Written 2026-08-25. Repo: `taranjs/calm-voice-power`, deployed via GitHub Pages
from `main` (every push to `main` goes live).

---

## 1. What this is and who it's for

A PWA built by a parent for their ~6-year-old son, who stammers. It is a daily
speech-practice companion, not a diagnostic or therapy replacement.

**The originating problem:** the boy was excited by the app at first, then lost
interest. The whole body of work below came from diagnosing why, and fixing each
cause. Any future work should be judged against the same question — *does this
give him a reason to open the app tomorrow?*

## 2. Stack and constraints

- Vanilla ES modules. **No build step, no framework, no bundler, no npm
  dependencies at runtime.** Keep it that way.
- Hash-less client-side route table (`js/modules/router.js`). Each page render
  function returns a DOM node and may attach a `page.__cleanup` teardown hook —
  the router calls it on navigate-away. Anything holding a mic, timer, audio
  node or speech utterance *must* clean up there.
- Persistence: **IndexedDB only** (`CalmVoiceDB`, v2). No `localStorage`
  anywhere in the codebase.
- Service worker precaches an explicit file manifest in `sw.js`.
  **Adding a JS file means adding it to that manifest and bumping
  `CACHE_NAME`** (currently `calm-voice-v12`) or the change never reaches the
  device.
- Target device is a child's phone/tablet. Big tap targets, no dense text.

## 3. The central technical decision: amplitude, not ASR

The app listens with the Web Audio `AnalyserNode` and analyses amplitude. It
**deliberately does not use `SpeechRecognition` / ASR**, and this must not be
"improved" later without understanding why:

> ASR scores word accuracy. It treats repetitions, prolongations and blocks as
> garbage input. Pointing that at a child who stammers builds exactly the wrong
> feedback loop — the app would systematically tell him he was failing at the
> precise moments he most needed encouragement.

What is measured instead, in `js/modules/voice.js`:

- **RMS** from `getByteTimeDomainData` → is he voicing at all?
- **Sustained voicing duration** → the breath/stretch games.
- **Onset rise time**, the 10% → 90% envelope rise, as a proxy for gentle vs
  hard glottal attack. Loudness-invariant, which is what makes it usable.

Mic is acquired with `noiseSuppression: false, autoGainControl: false` — both
browser features actively fight the thing being measured.

Key exports: `acquireMic()`, `releaseMic()`, `calibrateNoiseFloor()`,
`voiceThreshold()`, `createVoiceTracker({onFrame, onVoiceStart, onVoiceEnd,
onSettled, silenceToEndMs})`, `classifyOnset()`, `onsetTargetFrom()`,
`isRoomTooNoisy()`, `ONSET_GOAL_MS`.

## 4. Calibration — "teach the app your voice"

`js/components/voiceSetup.js`. Four steps framed as a game (mouse voice 🐭,
normal 🙂, lion roar 🦁, gentle "Apple" 🌱) rather than a settings form.

Threshold maths sits between the measured room and his measured quiet voice:

```js
const between = Math.sqrt(_noiseFloor * _profile.quiet);  // geometric mean
const ceiling = _profile.quiet * 0.8;
const floor   = _noiseFloor * 1.6;
return Math.min(ceiling, Math.max(between, floor));
```

Measured effect: a soft voice moved from a marginal 0.028-vs-0.025 margin to a
comfortable 0.016 threshold.

**Two bugs here that must not be reintroduced:**
- Noise floor uses the **median** of the calibration window and is capped at
  `NOISE_FLOOR_MAX`. It originally used the peak; one transient cough set the
  threshold beyond reach and the app went **silently deaf for the whole
  session**.
- The "your mouse voice was too loud, redo it" check offers **exactly one**
  retry, then accepts and clamps. Unlimited retries was an infinite trap with no
  exit for a child who can't whisper convincingly.

## 5. Motivation design (the actual product thesis)

Diagnosed causes of the original disengagement, each now fixed:

| Cause | Fix |
|---|---|
| Rewards decoupled from speech — coins for taps, not for talking | All 7 voice activities are now mic-gated |
| Punitive streak — one missed day destroyed weeks of work | Rest credits; streak always *derived*, never stored |
| Dead parent feedback loop — the 'after' emotion check was never routed | Routed; parent dashboard has real data |
| Finite content — ~65 fixed items, exhausted in weeks | Date-seeded generated content |
| No legible progress | Voice Powers screen, personal bests, Then vs Now recordings |
| No other person in the loop | Talk Together |
| No acceptance/desensitisation work at all | My Buddy |

Underlying theory: **self-determination theory** (competence / autonomy /
relatedness) and the **overjustification effect** — which is why several of the
newest features are deliberately **not scored and earn nothing**.

Reward economics in `state.js`: `awardRep(activity, base=5)` **tapers per
activity per day**, so grinding one game stops paying. `REP_FULL_PRICE = 3`,
`DAILY_BONUS = 15`, `SESSION_TARGET = 3`.

## 6. Feature inventory (23 routes)

**Core practice / games** — Calm Breath, Pacing Dots, Word Stretch, Gentle Start
(onset), Stretchy Speech, Pause Power, Record Me!

**Progress & identity** — Confidence Road (streak), My Voice Powers, Voice
Journal (Then vs Now), Rewards Shop, My Avatar, Parent Dashboard.

**The four that carry the motivation thesis:**

- **My Words** (`my-words`) — he adds his *own* hard words and records himself
  saying them; his recording becomes the model the games play back, falling back
  to TTS. Autonomy + the words that actually matter to him.
- **Talk Together** (`talk`) — turn-taking conversation with a real person in the
  room (Dad, Mum, etc). **Scored on turns taken only, never on fluency** —
  conversation is where pressure does the most damage. Works fully with the mic
  denied. Fills the missing rung between canned phrases and real-world
  challenges, which is where transfer actually happens.
- **My Buddy** (`buddy`) — a named creature that gets stuck on words; the child
  helps it. Four *valid* strategies, so there is no wrong answer, one of them
  being **voluntary stuttering** ("bounce on it, like b-b-bouncing") — standard
  desensitisation, framed as play. **Nothing is scored.** The buddy's lines are
  the payload: *"I got a bit stuck… and I said it anyway!"* and *"Thanks for
  waiting for me. People who wait are the best."* (the latter quietly teaches him
  what to ask of listeners).
- **Generated content** (`js/modules/content.js`) — mulberry32 PRNG seeded by
  date: same material all day so he can return to a word, different tomorrow.
  Clinical constraints live in the word banks, not left to chance — the gentle-
  onset bank is entirely **vowel-initial**; power words lean on **continuants**
  (you can prolong /m/ or /s/, not /p/).

## 7. Data model, shaped for future sync

- `practiceDays` — a **set of local date strings**. Chosen for CRDT-friendly
  union merge across devices: two devices can never disagree.
- `streak` — **always derived** via `computeStreak()`, never stored. Same reason.
- Rest credits: `REST_EARNED_EVERY = 5`, `REST_MAX = 2` — a missed day spends a
  credit before it breaks anything.
- `migratePracticeDays()` converts the v1 `streakDays` format and back-fills.
- IndexedDB stores: `settings`, `sessions`, `recordings`, `words`, `challenges`,
  `rewards`.
- `js/modules/storage.js` — asks `navigator.storage.persist()` once at boot so
  the browser won't evict him (iOS Safari clears after 7 days uninstalled). Never
  re-asks a granted origin (Firefox prompts). All failure paths return `null`;
  it is insurance, never a dependency. Parent dashboard reports the state and
  tells the parent to add to home screen if unprotected.

## 8. Testing

`tests/` in-repo, run with `bash tests/run.sh`. No npm install needed.

1. Syntax + import graph + service-worker manifest completeness
2. `unit.mjs` — pure logic (streak maths, reward tapering, onset classification)
3. `browser.mjs` — **real Chromium via Playwright with synthetic audio**
   (`--use-fake-device-for-media-stream`,
   `--use-file-for-fake-audio-capture`), fixtures generated by
   `make-fixtures.py`

Verified end-to-end, not mocked: hard attacks at 15–17ms classify `hard` 3/3;
gentle 300ms ramps at 233–250ms classify `gentle` 3/3.

**Testing gotcha that bit repeatedly:** async handlers mean you must wait for a
button to become *disabled*, then *enabled* — reading state immediately gives
false passes.

## 9. Recurring bug patterns worth watching for

- **Double-tap race**: all 7 voice activities claimed their busy flag *after*
  `await ensureMic()`, leaving a ~700ms window where a second tap started two
  listening sessions. Claim the flag and disable the button **synchronously**,
  reset on the failure path.
- **Silent failure is the enemy.** Every failure this app has had was invisible
  to the child, who would never report it — he'd just stop opening the app.
- Every mic-using page needs `page.__cleanup` releasing the mic.

## 10. Tone and copy rules

- No red, no buzzers, no failure sounds. Warm palette throughout.
- Getting stuck is drawn as **ordinary and survivable**, never as an error.
- Praise effort and turning up, not fluency: *"I noticed you kept going."*
- British spelling in child-facing copy ("practise" as verb).

## 11. State of play

All work complete and pushed. Latest commit `1961195` on `main`.

**Open questions for the parent:**
1. **Tone/age fit** — is the 🐱/🦄 register still right for him? Best resolved by
   asking him, not by guessing.
2. **Accounts and sync** — wanted, not started. Data shapes are already built
   for it (see §7).
3. Currently pushing straight to `main`, which deploys live to the app the child
   uses. No review branch.

**Suggested next step if sync is still far off:** an export/import button on the
parent dashboard dumping the whole DB to JSON, so his recordings survive a lost
phone. Roughly an hour's work. Persistence (§7) protects against *eviction* only
— not device loss, factory reset, or "clear browsing data".
