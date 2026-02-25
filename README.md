# 🌟 Calm Voice Power – Speech Fluency PWA

A mobile-first Progressive Web App for children (ages 6-10) to build speech fluency and confidence through guided practice, games, and encouragement.

## Features

- **Confidence Road** – Visual streak tracker journey
- **3-Min Calm Breath** – Guided breathing animation
- **Pacing Dots** – Speech rhythm trainer
- **Record Me!** – Web Audio recording with waveform, playback, and slow-play
- **Word Stretch** – Block reset animated letter stretching
- **Mini Games** – Gentle Onset, Stretchy Speech, Pause Challenge
- **Daily Challenges** – Real-world brave tries
- **Rewards & Avatar** – Coins, unlockable avatars, customization
- **Emotion Check-In** – Before/after emoji scale
- **Parent Dashboard** – Weekly chart, trends, coaching tips
- **Offline support** – Full service worker caching
- **IndexedDB** – All data stored locally

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
    │   ├── state.js     # App state
    │   ├── router.js    # Hash router
    │   ├── audio.js     # Web Audio API
    │   ├── toast.js     # Notifications
    │   └── avatar.js    # Avatar data
    ├── components/
    │   ├── nav.js
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

**Important for GitHub Pages:** Update `sw.js` ASSETS paths to include your repo name prefix if deploying to a subdirectory, e.g.:
```js
const ASSETS = ['/calm-voice-power/', '/calm-voice-power/index.html', ...]
```

## Psychological Principles

- ✅ Reinforce **effort, not fluency**
- ✅ No failure states or red error messages  
- ✅ Sessions capped at 3-5 minutes
- ✅ Identity-building language ("Your calm voice power")
- ✅ Encouragement-first toasts and feedback
- ✅ Positive emotion tracking (never comparative)

## Customization

- **Colors:** Edit CSS variables in `css/main.css` `:root`
- **Words/Phrases:** Edit arrays at top of each game/component file
- **Daily challenges:** Edit `defaultChallenges()` in `js/modules/state.js`
- **Avatar options:** Edit `AVATARS` in `js/modules/avatar.js`
- **Coin rewards:** Adjust `addCoins(N)` calls in each component
