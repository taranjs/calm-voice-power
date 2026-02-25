// js/components/parentDashboard.js
import { state } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

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
    const daySessions = sessions.filter(s => new Date(s.date).toDateString() === dateStr);
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

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Parent Dashboard 👨‍👩‍👧</h2>
        <p class="subtitle">Your child's progress</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
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
      <h3 style="margin-bottom:4px">Sessions This Week</h3>
      <p style="font-size:0.8rem;color:var(--ink-faint);margin-bottom:12px">Number of practice sessions per day</p>
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

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.querySelector('#avatar-btn').addEventListener('click', () => { playClick(); navigate('avatar'); });

  return page;
}
