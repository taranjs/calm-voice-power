# 🌟 Calm Voice Power – Speech Fluency PWA

A mobile-first Progressive Web App for children (ages 6-10) to build speech fluency and confidence through guided practice, games, and encouragement.

## Features

- **Voice-driven practice** – The microphone is the controller. Word Stretch, Stretchy
  Speech and Gentle Start all respond to the child's actual voice, so nothing can be
  earned by tapping in silence.
- **Spoken models** – Every target can be heard before it's attempted (`speechSynthesis`
  at slow rate, plus a soft-attack tone that models an easy onset).
- **Confidence Road** – Cumulative record of every day practised. It only ever grows.
- **3-Min Calm Breath** – Guided breathing animation
- **Pacing Dots** – Speech rhythm trainer
- **Record Me! + Voice Journal** – Recordings are kept, grouped by prompt, and shown as
  **Then vs Now** so progress is audible
- **Word Stretch** – Letters pull apart in time with sustained voicing
- **Mini Games** – Gentle Onset, Stretchy Speech, Pause Challenge
- **Daily Challenges** – Real-world brave tries
- **Rewards & Avatar** – Coins, unlockable avatars, customization
- **Emotion Check-In** – Before/after emoji scale
- **Parent Dashboard** – Weekly chart, trends, coaching tips
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
the speech target rather than engagement.

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
