// js/components/voiceJournal.js – "Then vs Now"
// The point of keeping recordings: a child who stammers gets almost no feedback
// that anything is improving, because progress is slow and invisible from the
// inside. Hearing himself from six weeks ago, next to himself today, is the one
// piece of evidence the app can offer that his own effort changed something.
import { navigate } from '../modules/router.js';
import { dbGetAll, dbDelete } from '../modules/db.js';
import { createAudioFromBlob, playClick } from '../modules/audio.js';
import { toast } from '../modules/toast.js';

export function renderVoiceJournal() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Voice Journal 🎧</h2>
        <p class="subtitle">Listen to how far you've come</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>
    <div id="journal-body">
      <p class="text-center" style="color:var(--ink-faint)">Loading your recordings…</p>
    </div>
  `;

  const body = page.querySelector('#journal-body');
  let playing = null;

  function stopPlaying() {
    if (!playing) return;
    playing.audio.pause();
    URL.revokeObjectURL(playing.url);
    playing = null;
  }

  function play(rec, btn, rate = 1) {
    stopPlaying();
    playClick();
    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    audio.playbackRate = rate;
    const label = btn.textContent;
    btn.textContent = '⏸ Playing…';
    audio.addEventListener('ended', () => {
      btn.textContent = label;
      URL.revokeObjectURL(url);
      if (playing?.audio === audio) playing = null;
    });
    playing = { audio, url };
    audio.play().catch(() => {
      btn.textContent = label;
      toast('Couldn’t play that one');
    });
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function daysBetween(a, b) {
    return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
  }

  function makePlayButton(rec, text, cls = 'btn-ghost', rate = 1) {
    const btn = document.createElement('button');
    btn.className = `btn ${cls}`;
    btn.style.cssText = 'min-height:42px;padding:8px 16px;font-size:0.9rem';
    btn.textContent = text;
    btn.addEventListener('click', () => play(rec, btn, rate));
    return btn;
  }

  async function load() {
    let all = [];
    try {
      all = await dbGetAll('recordings');
    } catch (e) {
      body.innerHTML = '<p class="text-center" style="color:var(--ink-faint)">Couldn’t open your recordings.</p>';
      return;
    }

    all = all.filter(r => r && r.blob).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!all.length) {
      body.innerHTML = `
        <div class="card card-soft text-center">
          <div style="font-size:3rem">🎙️</div>
          <p style="font-weight:800;margin-top:8px">No recordings yet</p>
          <p style="font-size:0.88rem;margin-top:6px">
            Record yourself saying the same thing every week. In a month you'll be able to
            hear the difference for yourself.
          </p>
          <button class="btn btn-primary mt-16" id="go-record">🎙️ Record my first one</button>
        </div>
      `;
      body.querySelector('#go-record').addEventListener('click', () => { playClick(); navigate('recorder'); });
      return;
    }

    // Group by prompt so we compare the same sentence over time.
    const groups = new Map();
    all.forEach(r => {
      const key = r.promptId || 'free';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    body.innerHTML = '';

    const comparable = [...groups.values()].filter(g => g.length >= 2);

    if (comparable.length) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = 'Then vs Now ✨';
      body.appendChild(title);

      comparable.forEach(group => {
        const then = group[0];
        const now  = group[group.length - 1];
        const gap  = daysBetween(then.date, now.date);

        const card = document.createElement('div');
        card.className = 'card mb-16';
        card.innerHTML = `
          <div style="font-weight:800;font-size:1rem">${then.promptText || 'Free talk'}</div>
          <p style="font-size:0.8rem;color:var(--ink-faint);margin-top:2px">
            ${gap > 0 ? `${gap} ${gap === 1 ? 'day' : 'days'} apart · ${group.length} recordings` : `${group.length} recordings`}
          </p>
          <div class="compare-row mt-16">
            <div class="compare-side">
              <div class="compare-label">Then</div>
              <div class="compare-date">${fmtDate(then.date)}</div>
              <div class="compare-actions"></div>
            </div>
            <div class="compare-arrow">→</div>
            <div class="compare-side">
              <div class="compare-label now">Now</div>
              <div class="compare-date">${fmtDate(now.date)}</div>
              <div class="compare-actions"></div>
            </div>
          </div>
        `;
        const [thenSlot, nowSlot] = card.querySelectorAll('.compare-actions');
        thenSlot.appendChild(makePlayButton(then, '▶ Play'));
        nowSlot.appendChild(makePlayButton(now, '▶ Play', 'btn-primary'));
        body.appendChild(card);
      });
    } else {
      const hint = document.createElement('div');
      hint.className = 'card card-soft mb-16 text-center';
      hint.innerHTML = `
        <p style="font-size:0.9rem;font-weight:700">
          Record the same sentence again in a week 🌱
        </p>
        <p style="font-size:0.85rem;margin-top:6px">
          Once there are two of the same one, they'll show up here side by side so you can hear the change.
        </p>
      `;
      body.appendChild(hint);
    }

    // Full history, newest first.
    const allTitle = document.createElement('div');
    allTitle.className = 'section-title mt-24';
    allTitle.textContent = `All recordings (${all.length})`;
    body.appendChild(allTitle);

    [...all].reverse().forEach(rec => {
      const row = document.createElement('div');
      row.className = 'custom-reward-item';
      row.innerHTML = `
        <div>
          <div class="custom-reward-name"></div>
          <div class="custom-reward-cost">${fmtDate(rec.date)} · ${Math.round((rec.durationMs || 0) / 1000)}s</div>
        </div>
        <div class="custom-reward-actions"></div>
      `;
      row.querySelector('.custom-reward-name').textContent = rec.promptText || 'Free talk';

      const actions = row.querySelector('.custom-reward-actions');
      actions.appendChild(makePlayButton(rec, '▶'));
      actions.appendChild(makePlayButton(rec, '🐢', 'btn-ghost', 0.6));

      const del = document.createElement('button');
      del.className = 'challenge-delete';
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete recording');
      del.textContent = '🗑️';
      del.addEventListener('click', async () => {
        playClick();
        stopPlaying();
        await dbDelete('recordings', rec.id);
        toast('Recording removed');
        load();
      });
      actions.appendChild(del);

      body.appendChild(row);
    });
  }

  load();

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.__cleanup = stopPlaying;

  return page;
}
