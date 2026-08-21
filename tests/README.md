# Tests

```bash
./tests/run.sh          # everything
./tests/run.sh unit     # pure logic only — fast, no browser
```

**What's covered.** The parts where a bug would be invisible rather than loud:

- **Streak** — that a missed day can never destroy the Confidence Road, and that
  rest days bridge a normal weekend.
- **Onset classifier** — that a hard glottal attack and an easy onset are told
  apart, and that the verdict doesn't change with loudness (a quiet child must
  not be marked down for being quiet).
- **Shaping** — that the personal goal follows him upward but never validates a
  habit he's practising to change.
- **Threshold** — that a calibrated threshold always stays below his own quiet
  voice, whatever the room. Being deaf to the child is the failure that makes
  him give up, and it fails silently.
- **The app in a real browser** — every route renders, the microphone is handed
  back on navigation, sessions log both emotions, coins taper, and his own voice
  recordings play back in the games.

**How the voice tests work.** Chrome accepts a WAV file as fake microphone input
(`--use-file-for-fake-audio-capture`), so the real detection code runs against
known audio instead of being mocked. `make-fixtures.py` generates three: a hard
attack, a gentle 300ms onset, and a quiet child. Fixtures are generated, not
committed.

Browser tests need `npx playwright install chromium`; without it they skip and
the unit tests still run.
