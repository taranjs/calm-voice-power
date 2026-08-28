# 🌟 Calm Voice Power – Speech Fluency PWA

A mobile-first Progressive Web App for children (ages 6-10) to build speech fluency and confidence through guided practice, games, and encouragement.

**[A guided tour →](https://taranjs.github.io/calm-voice-power/features.html)** — a screenshot of every
feature, tap-to-read reasoning for each one, and what is deliberately never scored. Written for speech and
language therapists, readable by anyone. Reachable in-app from the ❓ in the Parent Dashboard header.

Its screenshots are generated from the real app, never mocked up, with `./tools/screenshots.sh` —
which seeds invented progress first, so nothing on the public page is a real child's data. That script
also fingerprints `js/` and `css/`, and `tests/run.sh` then tells you when the tour has drifted behind
the app, so keeping it current isn't something you have to remember.

## Deploying

First time only, pin this repo to the right Cloudflare account:

```bash
./tools/cf-auth.sh    # paste an API token; it verifies it and finds the account
direnv allow
```

The token goes into the macOS keychain, and `.envrc` exports it as
`CLOUDFLARE_API_TOKEN` **only inside this directory**. Wrangler prefers that over its OAuth
session, so this project always deploys to the same account no matter what you last ran
`wrangler login` for — and nothing outside this directory is affected. No logout/login dance.
`./tools/cf-auth.sh --show` says whose token is stored, `--forget` removes it.

Create the token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
→ Custom token, with **Account · Cloudflare Pages · Edit** and **Account · Account Settings · Read**.
Nothing broader is needed.

Then, to publish by hand:

```bash
./tools/deploy.sh
```

### Automatic deploys, gated by the tests

`.github/workflows/deploy.yml` runs the whole suite on every push to `main` and deploys
**only if it passes**. A red suite means no deploy: the child's app keeps running the last
version that worked.

Set up once:

1. Deploy manually with `./tools/deploy.sh` — this creates the Cloudflare Pages project.
2. Add two repository secrets under **Settings → Secrets and variables → Actions**:
   - `CLOUDFLARE_API_TOKEN` — the same token `./tools/cf-auth.sh` stores
   - `CLOUDFLARE_ACCOUNT_ID` — printed by `./tools/cf-auth.sh --show`

**Do not also connect Cloudflare's own Git integration.** It builds on push regardless of
whether anything passes, so you would have two deploy paths and only one of them gated.

After deploying, the workflow fetches the live URL and checks the app shell, the guided tour,
`js/main.js` and `sw.js` all return 200 — a deploy can report success and still serve a
broken site.

It stages only the files the browser needs (`tests/`, `tools/` and the docs stay behind —
there is no build step, so the whole tree would otherwise go up), names the destination
account, and waits for confirmation, because deploying to the wrong account is not a mistake
you notice quickly.

**Before moving to a new address:** save a backup from the Parent Dashboard on the old one
and restore it on the new one. Storage is per-origin; the new address starts empty.

## Features

- **Voice-driven practice** – The microphone is the controller. Every scoring activity
  responds to the child's actual voice, so nothing can be earned by tapping in silence.
  Pause Power times real silence between real speech; Pacing Dots only credits a beat
  he voiced.
- **My Voice Powers** – Four powers that level up from his own measurements (onset
  softness, longest hold, longest pause, beats in a row), written in language a
  seven-year-old can act on.
- **Practice sessions** – Check in → three activities → check out, with a progress bar
  and a completion screen. This is what feeds the Parent Dashboard's emotion trend.
- **Spoken models, in his own voice** – "🔊 Hear it" plays *his* recording of a word
  when he has made one, falling back to `speechSynthesis` at slow rate. Plus a
  soft-attack tone that models an easy onset, which no synthesised voice can.
- **My Words** – He adds words of his own and records himself saying them well. His
  words join the practice pools; his recordings become the model.
- **Talk Together** – Turn-taking conversation practice with a real person in the room.
  Counts turns, never fluency.
- **My Buddy** – A friend who stammers, is fine about it, and needs *his* help. The
  acceptance and desensitisation side of the work.
- **Generated content** – Word banks and slot templates, seeded by the date: the same
  material all day, different tomorrow.
- **Confidence Road** – Cumulative record of every day practised. It only ever grows.
- **3-Min Calm Breath** – Guided breathing animation
- **Pacing Dots** – Speech rhythm trainer
- **Record Me! + Voice Journal** – Recordings are kept, grouped by prompt, and shown as
  **Then vs Now** so progress is audible
- **Word Stretch** – Letters pull apart in time with sustained voicing
- **Mini Games** – Gentle Onset, Stretchy Speech, Pause Challenge
- **Daily Challenges** – Real-world brave tries
- **Rewards & Avatar** – Coins (tapering per activity per day, plus a daily
  first-practice bonus), unlockable avatars, customization
- **Emotion Check-In** – Before/after emoji scale
- **Parent Dashboard** – Weekly chart, trends, coaching tips
- **Backup & restore** – One file holding practice days, coins, voice setup and every
  recording. Restoring **merges**, so it can never cost you data that is already on the
  device. Needed before changing phone or web address: IndexedDB is scoped to the origin,
  so a new address starts empty.
- **Offline support** – Full service worker caching
- **IndexedDB** – All data stored locally

## How the voice detection works

`js/modules/voice.js` analyses the raw amplitude envelope from `AnalyserNode`. There is
**no speech recognition, deliberately** – ASR scores word accuracy and treats
repetitions, prolongations and blocks as garbage input, which is the worst possible
feedback loop for a child who stammers. Amplitude analysis instead measures *how* a
sound was made:

| Measure | Used by | Meaning |
|---|---|---|
| Sustained voicing (ms) | Word Stretch, Stretchy Speech | how long a sound was held |
| Onset rise time (10%→90%) | Gentle Start | how abruptly the voice began |

`classifyOnset()` reports `gentle` / `okay` / `hard`. A hard glottal attack reaches full
volume in ~15ms; an easy onset ramps in over 200ms+. It's loudness-invariant, so a quiet
child isn't penalised.

Every activity still works with the microphone denied or missing; it just stops scoring.

### Calibration – "Teach me your voice"

`components/voiceSetup.js` measures the child himself rather than assuming a generic
one: his whisper 🐭, his talking voice 🙂 and his roar 🦁. The detection threshold is
then a **two-class split** between the measured room noise and his measured quiet voice
(their geometric mean, clamped to stay reachable). A soft speaker who used to fall below
the fixed threshold now gets one that suits him, and it adapts to whatever microphone
the device has.

Only numbers are stored – no audio – so the profile is a few floats that will sync
trivially alongside `practiceDays`.

The room floor is re-measured every session, because that changes constantly. The voice
profile persists until redone (Parent Dashboard → *Redo voice setup*).

### Shaping the gentle-onset goal

`onsetTargetFrom(samples)` sets the goal from his own recent median **plus 30ms**,
ratcheting up as he improves and capped at the real target of 110ms.

This is deliberately not a purely relative target. If "gentle" just meant *better than
his own average*, a child whose habit is a hard attack would be rewarded for the exact
habit he's practising to change. His baseline only sets the starting difficulty; the
line then moves as he earns it — successive approximation, the way shaping works in
therapy. There's a test for exactly this in the suite.

The Parent Dashboard charts the trend, which is the only number in the app that tracks
the speech target rather than engagement. `components/voicePowers.js` shows the child
his own version of the same thing.

## My Words — the child as author

`components/myWords.js` lets him add words and record himself saying them. From then
on the games play his recording instead of the synthesiser.

Recording a model is not a detour from practice: saying "Apple" with a soft gentle
start so the app can keep it *is* the exercise. So a model take is analysed like any
other attempt, counted toward his onset history, and fed back to him. Authoring and
practising are the same action.

His words join Word Stretch. Only his **vowel-initial** words join Gentle Start —
gentle-onset work targets the hard glottal attack that happens on vowels, so "Dinosaur"
would dilute it while "Octopus" belongs there. Words are keyed by a normalised form, so
one word can only ever have one model.

## Talk Together — the missing rung

The app had isolated words and canned phrases, then jumped straight to "ask your teacher
a question". Transfer happens in the middle, in real back-and-forth conversation, and
`components/talkTogether.js` is the only activity that lives there.

**Deliberately not scored on fluency.** Conversation is where pressure does the most
damage, so it counts turns taken and nothing else — how it sounded is none of the app's
business here. It also works with the microphone denied: then it's simply a turn-taking
game, which is most of the value anyway.

Then vs Now pairs can be shared from the Voice Journal via the Web Share API (falling
back to a download), because progress is worth far more when somebody else hears it.

## My Buddy — the part that isn't about fluency

Everything else in this app is about speaking more smoothly. On its own that carries a
quiet message: *smooth is good, stuck is bad*. A child who absorbs only that learns to
hide, avoid and dread getting stuck — and avoidance does far more damage across a
childhood than the stammer itself.

So `components/buddy.js` gives him a friend who stammers, is completely fine about it,
and needs him. Getting stuck is drawn plainly — no red, no buzzer — as something
ordinary and survivable. He picks how to help from four options that are all real
strategies, so there is no wrong answer, and one of them is **bouncing on the word on
purpose**: voluntary stuttering, the classic desensitisation move, framed as a game.

The buddy's lines are the point:

> "I got a bit stuck… and I said it anyway! Getting stuck did not stop me."
> "Thanks for waiting for me. People who wait are the best."

That second one is quietly teaching him what to ask of listeners.

Nothing here is scored.

## Generated content

`modules/content.js` holds word banks and slot templates rather than fixed lists. A
mulberry32 PRNG seeded from the date picks each day's material: stable all day so he can
return to a word he was working on, different tomorrow.

Constraints are encoded in the banks, not left to chance — the gentle-onset bank is
entirely vowel-initial (that's where the hard glottal attack happens), and the power-word
bank leans on continuants, since you can prolong /m/ or /s/ but not /p/.

## Coin economy

`awardRep(activity, base)` pays full price for the first three reps of an activity each
day, then tapers to a floor of 1. Eight reps of one activity pays 26 coins rather than
40. `recordPractice()` adds a 15-coin bonus for the first practice of the day.

The point isn't balance, it's the overjustification effect: dense per-rep rewards crowd
out the intrinsic motivation they're meant to support, and when they saturate, interest
lands *below* where it started. Coming back at all is the behaviour worth paying for.

## Data & future sync

Practice history is stored as `practiceDays: ['2026-08-13', …]` – a **set of dates**,
not a counter. That's the one shape that merges cleanly when two devices sync (union the
sets and the answer is right), so adding accounts later won't require a migration.
`streak` is always derived via `computeStreak()`, never stored as truth.

Missing a day **never** resets anything. Rest days are earned by practising and bridge
gaps automatically, and the Confidence Road is drawn from total days practised, which
only ever increases.

## Project Structure

```
fluency-app/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── main.css
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── js/
    ├── main.js
    ├── modules/
    │   ├── db.js        # IndexedDB wrapper
    │   ├── state.js     # App state, practice history, streak
    │   ├── router.js    # Route table (calls page.__cleanup on leave)
    │   ├── audio.js     # Web Audio API
    │   ├── voice.js     # Mic input: voicing duration + onset analysis
    │   ├── speech.js    # Spoken models via speechSynthesis
    │   ├── toast.js     # Notifications
    │   └── avatar.js    # Avatar data
    ├── components/
    │   ├── nav.js
    │   ├── micPanel.js     # Shared "I can hear you" meter
    │   ├── voiceSetup.js   # Voice calibration game
    │   ├── voiceJournal.js # Then vs Now recordings
    │   ├── home.js
    │   ├── emotionCheck.js
    │   ├── streakRoad.js
    │   ├── breathingSession.js
    │   ├── pacingDots.js
    │   ├── recorder.js
    │   ├── blockReset.js
    │   ├── dailyChallenge.js
    │   ├── rewards.js
    │   ├── avatarBuilder.js
    │   ├── parentDashboard.js
    │   ├── practiceHub.js
    │   └── gamesHub.js
    └── games/
        ├── gentleOnset.js
        ├── stretchySpeech.js
        └── pauseChallenge.js
```

## Tests

```bash
./tests/run.sh          # everything
./tests/run.sh unit     # pure logic only — fast, no browser
```

Chrome accepts a WAV as fake microphone input, so the voice detection is tested against
known audio rather than mocked. See `tests/README.md`.

## Running Locally

**Option 1 – Python server (recommended):**
```bash
cd fluency-app
python3 -m http.server 8080
# Open http://localhost:8080
```

**Option 2 – VS Code Live Server:**
Right-click `index.html` → Open with Live Server

**Note:** Service workers require HTTPS or localhost. Direct file:// won't work.

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push all files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Calm Voice Power PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/calm-voice-power.git
   git push -u origin main
   ```
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch → main → / (root)**
5. Click **Save**
6. Your app will be live at `https://YOUR_USERNAME.github.io/calm-voice-power/`

`sw.js` now uses relative asset paths, so it works on GitHub Pages subdirectory deployments without manual repo-name prefix edits.

## Psychological Principles

- ✅ Reinforce **effort, not fluency** – rewards require a real attempt at the target,
  never a button press. Nothing scores a stammer as a failure, because nothing measures
  word accuracy at all.
- ✅ No failure states. An unheard attempt says "I couldn't hear that" and offers another
  turn; a hard onset gets a coaching cue, not a penalty.
- ✅ **Nothing the child earns is ever taken away.** A missed day cannot reduce the
  Confidence Road, the milestones, or the days-practised count.
- ✅ Sessions capped at 3-5 minutes
- ✅ Identity-building language ("Your calm voice power")
- ✅ Specific feedback over generic praise ("you held that for 2.1 seconds" beats
  "Amazing!" – children detect non-contingent praise quickly and discount it)
- ✅ Positive emotion tracking (never comparative)

## Customization

- **Colors:** Edit CSS variables in `css/main.css` `:root`
- **Words/Phrases:** Edit arrays at top of each game/component file
- **Daily challenges:** Edit `defaultChallenges()` in `js/modules/state.js`
- **Avatar options:** Edit `AVATARS` in `js/modules/avatar.js`
- **Coin rewards:** Adjust `addCoins(N)` calls in each component
