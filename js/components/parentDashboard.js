// js/components/parentDashboard.js
import { state, hasVoiceProfile } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';
import { onsetTargetFrom, ONSET_GOAL_MS } from '../modules/voice.js';
import { storageReport, isInstalled } from '../modules/storage.js';
import { exportAll, importAll, parseBackup, backupFilename, BackupError } from '../modules/backup.js';
import { loadState } from '../modules/state.js';
import { toast } from '../modules/toast.js';

const TIPS = [
  'Celebrate every attempt, not just perfect speech. Say "I love how you kept trying!"',
  'Avoid finishing sentences for your child – it feels discouraging. Wait with a smile.',
  'Model slow, relaxed speech yourself – children absorb your pace naturally.',
  'Short daily practice (3-5 min) beats long sporadic sessions. Consistency matters most.',
  'When your child struggles, breathe together first. A calm body makes a calmer voice.',
  'Use "I noticed you…" praise: "I noticed you kept going even though it felt hard. Brave!"',
  'Never draw attention to moments of difficulty – focus on what went well.',
];

const EMOTION_LABELS = ['Not great', 'A bit meh', 'Okay', 'Pretty good', 'Amazing!'];
const EMOTION_EMOJIS = ['😔','😕','😐','🙂','😄'];

export function renderParentDashboard() {
  const page = document.createElement('div');
  page.className = 'page';

  const sessions = state.sessions.slice(-30);
  const totalMins = state.totalMinutes;
  const streak = state.streak;
  const coins = state.coins;

  // Build 7-day chart data
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const now = new Date();
  const weekData = Array.from({length: 7}, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toDateString();
    const daySessions = sessions.filter(s =>
      s.type !== 'session' && new Date(s.date).toDateString() === dateStr);
    return { label: days[d.getDay() === 0 ? 6 : d.getDay()-1], count: daySessions.length };
  });

  const maxCount = Math.max(...weekData.map(d => d.count), 1);

  // Emotion trend
  const recentEmotions = sessions.filter(s => s.emotionBefore).slice(-7);
  const avgBefore = recentEmotions.length
    ? Math.round(recentEmotions.reduce((a,s) => a + s.emotionBefore, 0) / recentEmotions.length)
    : null;
  const avgAfter = sessions.filter(s => s.emotionAfter).slice(-7).reduce((a,s,_,arr) =>
    a + s.emotionAfter / arr.length, 0);
  const avgAfterRound = Math.round(avgAfter) || null;

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  // Gentle-onset trend. Rise time is how long the voice takes to build up at the
  // start of a word: a hard glottal attack is ~15ms, an easy onset 110ms+. This
  // is the one number here that tracks the actual speech target rather than
  // engagement, so it's worth showing you honestly – including when it's flat.
  const onsets = state.voiceProfile?.onsetSamples || [];
  const median = arr => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null;
  };
  const half = Math.floor(onsets.length / 2);
  const earlier = onsets.length >= 6 ? median(onsets.slice(0, half)) : null;
  const recent  = onsets.length >= 3 ? median(onsets.slice(-half || -3)) : null;
  const goalMs  = onsetTargetFrom(onsets);

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Parent Dashboard 👨‍👩‍👧</h2>
        <p class="subtitle">Your child's progress</p>
      </div>
      <div class="action-row" style="gap:8px">
        <!-- Why the app is built the way it is. Sits up here rather than in a
             card at the bottom because a therapist being shown the app should
             not have to scroll past a fortnight of a child's mood data to find
             it. Opens outside the app, so a stray tap never replaces a
             practice session with an essay. -->
        <a class="btn btn-ghost" id="why-link" href="./features.html" target="_blank" rel="noopener"
           title="How this app works — a guided tour" aria-label="How this app works — a guided tour"
           style="padding:10px 16px;font-size:1rem;text-decoration:none;line-height:1">❓</a>
        <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-row mb-16">
      <div class="stat-box card-soft card">
        <div class="stat-val" style="color:var(--sun-warm)">🔥 ${streak}</div>
        <div class="stat-key">Day Streak</div>
      </div>
      <div class="stat-box card-mint card">
        <div class="stat-val" style="color:var(--mint)">⏱️ ${totalMins}</div>
        <div class="stat-key">Total Mins</div>
      </div>
      <div class="stat-box card card-lavender">
        <div class="stat-val" style="color:var(--lavender)">🪙 ${coins}</div>
        <div class="stat-key">Coins</div>
      </div>
    </div>

    <!-- Weekly chart -->
    <div class="card mb-16">
      <h3 style="margin-bottom:4px">Practice This Week</h3>
      <p style="font-size:0.8rem;color:var(--ink-faint);margin-bottom:12px">Activities completed per day</p>
      <div class="chart-bar-wrap" id="week-chart"></div>
    </div>

    <!-- Emotion trend -->
    <div class="card mb-16">
      <h3 style="margin-bottom:12px">Emotional Trend</h3>
      ${avgBefore !== null ? `
        <div class="flex-between mb-8">
          <span style="font-size:0.85rem;color:var(--ink-faint)">Before practice avg:</span>
          <span style="font-weight:800">${EMOTION_EMOJIS[avgBefore-1]} ${EMOTION_LABELS[avgBefore-1]}</span>
        </div>
        <div class="flex-between">
          <span style="font-size:0.85rem;color:var(--ink-faint)">After practice avg:</span>
          <span style="font-weight:800">${avgAfterRound ? EMOTION_EMOJIS[avgAfterRound-1] : '–'} ${avgAfterRound ? EMOTION_LABELS[avgAfterRound-1] : 'Not yet recorded'}</span>
        </div>
        ${avgAfterRound && avgAfterRound >= avgBefore ? '<p style="color:var(--mint);font-weight:700;margin-top:10px;font-size:0.9rem">✨ Practice is improving your child\'s mood!</p>' : ''}
      ` : '<p style="color:var(--ink-faint);font-size:0.85rem">Complete sessions to see emotion trends.</p>'}
    </div>

    <!-- Gentle onset trend -->
    <div class="card mb-16">
      <h3 style="margin-bottom:4px">Gentle Starts</h3>
      <p style="font-size:0.8rem;color:var(--ink-faint);margin-bottom:12px">
        How long the voice takes to build up at the start of a word. Longer is gentler –
        a hard attack is around 15ms, an easy onset ${ONSET_GOAL_MS}ms or more.
      </p>
      ${recent === null ? `
        <p style="color:var(--ink-faint);font-size:0.85rem">
          ${hasVoiceProfile()
            ? 'Play Gentle Start a few times to see this.'
            : 'Run “Teach Me Your Voice” in Practice first, then play Gentle Start.'}
        </p>
      ` : `
        <div class="flex-between mb-8">
          <span style="font-size:0.85rem;color:var(--ink-faint)">Recent average:</span>
          <span style="font-weight:800">${recent}ms</span>
        </div>
        ${earlier !== null ? `
          <div class="flex-between mb-8">
            <span style="font-size:0.85rem;color:var(--ink-faint)">When they started:</span>
            <span style="font-weight:800">${earlier}ms</span>
          </div>` : ''}
        <div class="flex-between">
          <span style="font-size:0.85rem;color:var(--ink-faint)">Current goal:</span>
          <span style="font-weight:800">${goalMs}ms${goalMs >= ONSET_GOAL_MS ? ' 🏅' : ''}</span>
        </div>
        ${earlier !== null && recent > earlier
          ? `<p style="color:var(--mint);font-weight:700;margin-top:10px;font-size:0.9rem">✨ Starts are ${Math.round(((recent - earlier) / earlier) * 100)}% gentler than when they began.</p>`
          : earlier !== null
            ? '<p style="color:var(--ink-faint);margin-top:10px;font-size:0.85rem">Holding steady for now – this one moves slowly, and that is normal.</p>'
            : ''}
      `}
      <div class="action-row mt-16">
        <button class="btn btn-ghost" id="recalibrate-btn" style="font-size:0.85rem">🎤 Redo voice setup</button>
      </div>
    </div>

    <!-- Coaching tip -->
    <div class="card card-sun mb-16">
      <div style="font-weight:800;margin-bottom:8px">💡 Coaching Tip for Today</div>
      <p style="font-size:0.9rem;line-height:1.6">${tip}</p>
    </div>

    <!-- Recent sessions -->
    <div class="card">
      <h3 style="margin-bottom:12px">Recent Sessions</h3>
      ${sessions.length === 0
        ? '<p style="color:var(--ink-faint);font-size:0.85rem">No sessions yet – encourage your child to try!</p>'
        : sessions.slice(-5).reverse().map(s => `
            <div class="flex-between mb-8" style="padding:8px 0;border-bottom:1px solid var(--sky-light)">
              <div>
                <div style="font-weight:700;font-size:0.9rem">${new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                <div style="font-size:0.75rem;color:var(--ink-faint)">${new Date(s.date).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div style="text-align:right">
                ${s.emotionBefore ? `<span>${EMOTION_EMOJIS[s.emotionBefore-1]}</span>` : ''}
                <span style="margin:0 4px">→</span>
                ${s.emotionAfter ? `<span>${EMOTION_EMOJIS[s.emotionAfter-1]}</span>` : '<span style="color:var(--ink-faint)">–</span>'}
              </div>
            </div>
          `).join('')}
    </div>

    <!-- Where the child's progress lives -->
    <div class="card mt-16" id="storage-card">
      <div style="font-weight:800;margin-bottom:8px">💾 Progress on this device</div>
      <p style="font-size:0.85rem;line-height:1.6" id="storage-note">Checking…</p>
    </div>

    <!-- Backup. IndexedDB is scoped to one origin on one device: a new phone or
         a new web address hands the app an empty database and every recording is
         gone. Persistence protects against eviction, not against that. -->
    <div class="card mt-16">
      <div style="font-weight:800;margin-bottom:8px">📦 Back up or move to a new device</div>
      <p style="font-size:0.85rem;line-height:1.6;color:var(--ink-soft)">
        Saves everything — practice days, coins, voice setup and every recording — as one file.
        Restoring <strong>adds</strong> to what is already here, so nothing on this device is lost.
        Worth doing before changing phone or if the app moves to a new web address.
      </p>
      <div class="action-row mt-16">
        <button class="btn btn-ghost" id="backup-btn" style="font-size:0.85rem">⬇️ Save a backup</button>
        <button class="btn btn-ghost" id="restore-btn" style="font-size:0.85rem">⬆️ Restore a backup</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" style="display:none" />
      <p style="font-size:0.8rem;color:var(--ink-faint);margin-top:10px" id="backup-note"></p>
    </div>

    <div class="mt-16 text-center">
      <button class="btn btn-ghost" id="avatar-btn">🎨 Customize Avatar</button>
    </div>
  `;

  // Draw chart
  const chart = page.querySelector('#week-chart');
  weekData.forEach(d => {
    const col = document.createElement('div');
    col.className = 'chart-bar-col';
    const pct = (d.count / maxCount) * 100;
    col.innerHTML = `
      <div class="chart-bar-val">${d.count || ''}</div>
      <div class="chart-bar" style="height:${Math.max(pct,4)}px"></div>
      <div class="chart-bar-label">${d.label}</div>
    `;
    chart.appendChild(col);
  });

  // Everything he has earned lives in this browser on this device and nowhere
  // else. A parent is the only one who can act on that, so say it plainly here
  // rather than leaving it as a silent assumption.
  (async () => {
    const { persisted, usedMB } = await storageReport();
    const note = page.querySelector('#storage-note');
    if (!note) return;
    const size = usedMB != null && usedMB >= 0.1 ? ` Currently using ${usedMB.toFixed(1)} MB.` : '';

    if (persisted === true) {
      note.innerHTML =
        `<strong style="color:var(--mint)">Protected.</strong> Their streak, coins and recordings are ` +
        `marked so this browser won't clear them automatically.${size} They still live only on this ` +
        `device — they won't appear on another phone or tablet.`;
    } else if (persisted === false && !isInstalled()) {
      note.innerHTML =
        `<strong style="color:var(--sun-warm)">Not protected yet.</strong> Everything they have earned is ` +
        `saved only in this browser on this device, and browsers can clear that after a stretch without ` +
        `opening the app — taking their streak and recordings with it. Adding Calm Voice to the home ` +
        `screen (Share → Add to Home Screen) makes that far less likely.${size}`;
    } else {
      note.innerHTML =
        `Saved in this browser on this device only — not synced anywhere, and not visible on another ` +
        `phone or tablet.${size}`;
    }
  })();


  // ── Backup ──────────────────────────────────────
  const backupBtn  = page.querySelector('#backup-btn');
  const restoreBtn = page.querySelector('#restore-btn');
  const fileInput  = page.querySelector('#restore-file');
  const backupNote = page.querySelector('#backup-note');

  const say = (msg, colour = 'var(--ink-faint)') => {
    backupNote.style.color = colour;
    backupNote.textContent = msg;
  };

  // Hand the file over by whatever route this platform actually supports.
  // Never dead-end: at this point the backup exists, and the only failure worth
  // reporting is being unable to get it off the device by any means.
  async function handOver(file) {
    // iOS gives an installed PWA no usable <a download>, so the share sheet is
    // the only way a file leaves the device there — try it first where offered.
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: 'Calm Voice backup' });
        return 'shared';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
        // Everything else falls through to a download. The common one is
        // NotAllowedError: encoding the recordings takes long enough that the
        // tap's user activation has expired by the time share() is called.
      }
    }
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return 'downloaded';
    } catch {
      // Last resort: put it on screen so it can be saved by hand.
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'opened';
    }
  }

  backupBtn.addEventListener('click', async () => {
    playClick();
    // Claim the button synchronously: encoding the recordings takes a moment and
    // a second tap would build the whole file twice.
    backupBtn.disabled = true;
    const label = backupBtn.textContent;
    backupBtn.textContent = 'Saving…';
    say('Gathering everything…');

    // Building and saving fail for completely different reasons, and telling
    // them apart is the difference between a fixable report and a shrug.
    let file, skipped = 0;
    try {
      const { data, skipped: missed } = await exportAll();
      skipped = missed;
      file = new File([JSON.stringify(data)], backupFilename(), { type: 'application/json' });
    } catch (e) {
      say(`Could not read the saved data (${e?.name || 'error'}). Nothing was changed.`, 'var(--coral)');
      backupBtn.disabled = false; backupBtn.textContent = label;
      return;
    }

    const mb   = (file.size / 1048576).toFixed(1);
    const note = skipped ? ` ${skipped} recording${skipped === 1 ? '' : 's'} could not be read and ${skipped === 1 ? 'is' : 'are'} not in it.` : '';
    try {
      const how = await handOver(file);
      if (how === 'cancelled') say('');
      else if (how === 'shared') say(`Backup shared — ${mb} MB.${note}`, 'var(--mint)');
      else say(`Saved ${file.name} — ${mb} MB. Keep it somewhere that is not this device.${note}`,
               'var(--mint)');
    } catch (e) {
      say(`Built the backup (${mb} MB) but could not save it here (${e?.name || 'error'}). ` +
          `Try again from a browser tab rather than the installed app.`, 'var(--coral)');
    } finally {
      backupBtn.disabled = false;
      backupBtn.textContent = label;
    }
  });

  restoreBtn.addEventListener('click', () => { playClick(); fileInput.click(); });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    restoreBtn.disabled = true;
    const label = restoreBtn.textContent;
    restoreBtn.textContent = 'Restoring…';
    say('Reading the backup…');
    try {
      const added = await importAll(parseBackup(await file.text()));
      await loadState();   // streak is derived, so it has to be recomputed
      const bits = [
        added.days       ? `${added.days} new practice day${added.days === 1 ? '' : 's'}` : '',
        added.recordings ? `${added.recordings} recording${added.recordings === 1 ? '' : 's'}` : '',
        added.words      ? `${added.words} word${added.words === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      say(bits.length ? `Restored — ${bits.join(', ')}.` : 'Restored. Nothing new was in that file.',
          'var(--mint)');
      toast('Backup restored 📦', 'success');
      // Re-render so the charts and totals show what just arrived.
      setTimeout(() => navigate('parent'), 900);
    } catch (e) {
      say(e instanceof BackupError ? e.message
                                   : 'Could not read that backup. Nothing was changed.', 'var(--coral)');
    } finally {
      restoreBtn.disabled = false;
      restoreBtn.textContent = label;
      fileInput.value = '';   // let the same file be picked again after a failure
    }
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.querySelector('#why-link').addEventListener('click', () => playClick());
  page.querySelector('#avatar-btn').addEventListener('click', () => { playClick(); navigate('avatar'); });
  page.querySelector('#recalibrate-btn').addEventListener('click', () => { playClick(); navigate('voice-setup'); });

  return page;
}
