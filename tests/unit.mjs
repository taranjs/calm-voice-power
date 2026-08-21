// tests/unit.mjs – pure logic, no browser needed.
// Run via tests/run.sh, which stubs out the IndexedDB import in state.js so the
// real algorithms can be exercised verbatim in node.
import { computeStreak, restAllowance, dayKey } from './.tmp/state.mjs';
import { classifyOnset, onsetTargetFrom, setVoiceProfile, voiceThreshold,
         isRoomTooNoisy, ONSET_GOAL_MS } from './.tmp/voice.mjs';

let ok = true;
const t = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok = cond && ok;
};
const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };

console.log('\nStreak — a missed day must never destroy anything');
t('no history', computeStreak([]) === 0);
t('practised today', computeStreak([back(0)]) === 1);
t('three in a row', computeStreak([back(2), back(1), back(0)]) === 3);
t('none yet today keeps yesterday\'s run', computeStreak([back(3), back(2), back(1)]) === 3);
t('a gap with no rest credit yet', computeStreak([back(4), back(3), back(0)]) === 1);
const twelve = Array.from({ length: 12 }, (_, i) => back(i + 3));
t('12-day run survives a weekend gap', computeStreak([...twelve, back(0)]) === 13);
const longAgo = Array.from({ length: 20 }, (_, i) => back(i + 60));
t('a long absence zeroes the streak', computeStreak(longAgo) === 0);
t('  …but every practised day is still on record', longAgo.length === 20);
t('rest credits cap at 2', restAllowance(Array(40).fill(0)) === 2, `${restAllowance(Array(40).fill(0))}`);

console.log('\nOnset classifier — measures how a sound starts, not what was said');
const env = (riseMs, peak = 0.3, total = 450) => {
  const out = [];
  for (let x = 0; x <= total; x += 16) {
    out.push({ t: x, level: riseMs === 0 ? peak : Math.min(peak, peak * (x / riseMs)) });
  }
  return out;
};
t('instant attack is hard', classifyOnset(env(0)).quality === 'hard');
t('30ms attack is hard', classifyOnset(env(30)).quality === 'hard');
t('80ms attack is the middle ground', classifyOnset(env(80)).quality === 'okay');
t('200ms ramp is gentle', classifyOnset(env(200)).quality === 'gentle');
t('quiet child judged the same as a loud one',
  classifyOnset(env(200, 0.06)).quality === classifyOnset(env(200, 0.85)).quality);
t('silence returns null', classifyOnset(env(0, 0)) === null);
t('too few samples returns null', classifyOnset([{ t: 0, level: 0.2 }]) === null);

console.log('\nShaping — the goal follows him without endorsing his habit');
t('no history uses the real goal', onsetTargetFrom([]) === ONSET_GOAL_MS);
const beginner = onsetTargetFrom([18, 22, 25, 20, 30]);
t('a beginner gets a reachable goal', beginner > 25 && beginner < ONSET_GOAL_MS, `${beginner}ms`);
t('  …never below the hard-attack band', beginner >= 70, `${beginner}ms`);
t('goal rises as he improves', onsetTargetFrom([55, 60, 65, 58, 70]) > beginner);
t('goal caps at the real target', onsetTargetFrom([120, 130, 115, 140, 125]) === ONSET_GOAL_MS);
const habit = onsetTargetFrom([15, 18, 16, 20, 14]);
t('his habitual hard onset is NOT scored gentle',
  classifyOnset(env(16), { gentleMs: habit }).quality !== 'gentle', `goal ${habit}ms`);
t('a genuine improvement is rewarded',
  classifyOnset(env(110), { gentleMs: habit }).quality === 'gentle');

console.log('\nThreshold — measured from this child, not guessed');
setVoiceProfile(null);
t('no profile falls back to the generic guess', Math.abs(voiceThreshold() - 0.025) < 1e-9);
setVoiceProfile({ quiet: 0.022, normal: 0.07, loud: 0.20 });
const soft = voiceThreshold();
t('a soft speaker gets a reachable threshold', soft < 0.022, soft.toFixed(4));
t('  …lower than the old fixed 0.025', soft < 0.025, `${soft.toFixed(4)} vs 0.0250`);
setVoiceProfile({ quiet: 0.09, normal: 0.22, loud: 0.5 });
t('a louder child gets a higher one', voiceThreshold() > soft, voiceThreshold().toFixed(4));
for (const quiet of [0.015, 0.03, 0.06, 0.12, 0.3]) {
  setVoiceProfile({ quiet, normal: quiet * 3, loud: quiet * 6 });
  t(`stays reachable at quiet=${quiet}`, voiceThreshold() < quiet, voiceThreshold().toFixed(4));
}
setVoiceProfile({ quiet: 0.02, normal: 0.06, loud: 0.15 });
t('a quiet room is not flagged noisy', !isRoomTooNoisy());

console.log(ok ? '\nUNIT PASS' : '\nUNIT FAIL');
process.exit(ok ? 0 : 1);
