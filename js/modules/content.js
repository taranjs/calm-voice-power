// js/modules/content.js – practice material, generated rather than hardcoded
//
// The app used to hold about 65 fixed items across every activity. An excited
// child sees all of it in two sittings and then the app has nothing it hasn't
// already shown him. Word banks plus slot templates give effectively unbounded
// material from a compact source.
//
// Selection is seeded by the date, so today's words are the same all day (he
// can come back to a word he was working on) but different tomorrow.

// ── Word banks ─────────────────────────────────────────────
// Vowel-initial only. Gentle-onset work targets the hard glottal attack, which
// is what happens when a vowel is launched abruptly – a consonant word would
// not exercise it.
export const GENTLE_BANK = [
  'Apple', 'Air', 'Open', 'Every', 'Umbrella', 'Easy', 'Only', 'Able', 'Elephant', 'Ice',
  'Otter', 'Under', 'Orange', 'Island', 'Ocean', 'Owl', 'Uncle', 'Empty', 'Igloo', 'Eagle',
  'Oven', 'Extra', 'Ant', 'Arm', 'Egg', 'End', 'Ink', 'Up', 'Old', 'Out',
  'Eat', 'Ear', 'Add', 'Ask', 'Away', 'About', 'After', 'Again', 'Also', 'Always',
  'Animal', 'Answer', 'Around', 'Awesome', 'Amazing', 'Adventure', 'Astronaut', 'Alligator',
  'Envelope', 'Everything', 'Underwater', 'Understand', 'Octopus', 'October', 'Ordinary',
  'Iceberg', 'Idea', 'Important', 'Afternoon', 'Elbow', 'Engine', 'Eleven', 'Eighty',
];

// Prolongation lives on continuants – m, n, l, r, s, f, v, w, y and vowels can
// be stretched; a plosive like /p/ or /k/ cannot. The bank leans that way.
export const POWER_BANK = [
  'EASY', 'SLOW', 'CALM', 'SMOOTH', 'GENTLE', 'SOFT', 'BRAVE', 'STRONG', 'READY', 'MELLOW',
  'LOVELY', 'WARM', 'WAVE', 'MOON', 'RAIN', 'SUNNY', 'MUSIC', 'MIGHTY', 'WONDER', 'RIVER',
  'SMILE', 'SHINE', 'FLOW', 'GLOW', 'ROAM', 'MELT', 'MORNING', 'SUMMER', 'WINTER', 'YELLOW',
  'SILVER', 'LEMON', 'NOISY', 'FLOAT', 'WANDER', 'MARVEL', 'LISTEN', 'WHISPER', 'RAINBOW',
  'SUNSHINE', 'MOUNTAIN', 'FEATHER', 'FOREST', 'MEADOW', 'LULLABY', 'WILLOW',
];

// Hyphens mark the syllable beats the pacing dots follow.
export const PACING_BANK = {
  1: ['Rain', 'Sun', 'Star', 'Moon', 'Sky', 'Tree', 'Bird', 'Cloud', 'Fish', 'Book',
      'Ball', 'Cake', 'Snow', 'Leaf', 'Shell', 'Boat', 'Train', 'Cheese', 'Bread', 'Green'],
  2: ['But-ter', 'Hap-py', 'Pret-ty', 'Sim-ple', 'Eas-y', 'Rab-bit', 'Din-ner', 'Sum-mer',
      'Win-ter', 'Yel-low', 'Pur-ple', 'Mon-key', 'Pen-cil', 'Gar-den', 'Cir-cle', 'Tid-y',
      'Rock-et', 'Cas-tle', 'Thun-der', 'Riv-er'],
  3: ['Beau-ti-ful', 'Won-der-ful', 'Fan-tas-tic', 'Hap-pi-ness', 'Va-ca-tion', 'A-maz-ing',
      'To-mor-row', 'Re-mem-ber', 'To-geth-er', 'Un-der-stand', 'Din-o-saur', 'Choc-o-late',
      'Bi-cy-cle', 'El-e-phant', 'Ad-ven-ture', 'But-ter-fly', 'Straw-ber-ry', 'To-ma-to'],
  4: ['Cat-er-pil-lar', 'Wa-ter-mel-on', 'Hel-i-cop-ter', 'Al-li-ga-tor', 'In-vis-i-ble',
      'Im-pos-si-ble', 'Tel-e-vis-ion', 'Su-per-mar-ket', 'In-cred-i-ble', 'Ex-per-i-ment'],
};

// ── Slot banks for the sentence templates ──────────────────
const SLOTS = {
  person:   ['Mum', 'Dad', 'my teacher', 'my friend', 'Grandma', 'Grandad', 'someone in my family'],
  thing:    ['dinosaurs', 'ice cream', 'football', 'my bike', 'space', 'dogs', 'drawing', 'swimming',
             'pizza', 'music', 'rockets', 'the beach', 'my books', 'building things'],
  feeling:  ['happy', 'excited', 'proud', 'sleepy', 'silly', 'calm', 'brave'],
  place:    ['park', 'shops', 'garden', 'library', 'seaside', 'playground', 'woods'],
  food:     ['an apple', 'some water', 'a biscuit', 'more juice', 'a sandwich'],
  activity: ['play a game', 'go outside', 'build something', 'read a story', 'kick a ball'],
  fun:      ['funny', 'brilliant', 'brave', 'clever', 'kind'],
};

const STRETCH_TEMPLATES = [
  { text: 'Heeey there!',            target: 1200, hint: 'Stretch the H-E-Y!' },
  { text: 'Goood morning!',          target: 1000, hint: 'Make the OOO longer' },
  { text: 'Myyy name is…',           target: 1100, hint: 'Float on the M-Y' },
  { text: 'I loooove {thing}!',      target: 1300, hint: 'Ride the LOVE sound' },
  { text: 'Sooo much fun!',          target: 900,  hint: 'Stretch the S gently' },
  { text: 'Niiiice to meet you!',    target: 1400, hint: 'Glide through NICE' },
  { text: 'Weeell hello!',           target: 1000, hint: 'Lean on the W' },
  { text: 'Mmmm, {food} please!',    target: 1200, hint: 'Hum the M first' },
  { text: 'Loooook at that!',        target: 1100, hint: 'Hold the OO' },
  { text: 'Yeeees please!',          target: 1000, hint: 'Let the Y glide' },
  { text: 'Waaait for me!',          target: 1200, hint: 'Stretch the WAY' },
  { text: 'Soooo {feeling} today!',  target: 1300, hint: 'Slide through SO' },
  { text: 'Nooo way!',               target: 900,  hint: 'Hum into the N' },
  { text: 'Reeeally good!',          target: 1200, hint: 'Roll the R out' },
];

const PAUSE_TEMPLATES = [
  { text: 'I am … so {feeling} … today!',            pauses: 2, target: 800 },
  { text: 'My name … is … very cool!',               pauses: 2, target: 800 },
  { text: 'I like … {thing} … and {thing}!',         pauses: 2, target: 700 },
  { text: 'Take a … big … deep breath!',             pauses: 2, target: 900 },
  { text: 'Today I … went to … the {place}!',        pauses: 2, target: 800 },
  { text: 'Can I … please have … {food}?',           pauses: 2, target: 800 },
  { text: 'Do you … want to … {activity}?',          pauses: 2, target: 800 },
  { text: 'That was … really … {fun}!',              pauses: 2, target: 750 },
  { text: 'I went … with {person} … to the {place}!',pauses: 2, target: 850 },
];

const CHALLENGE_TEMPLATES = [
  { text: 'Say good morning to {person}',            icon: '☀️' },
  { text: 'Ask {person} for {food}',                 icon: '🙋' },
  { text: 'Tell {person} one fun fact',              icon: '🌟' },
  { text: 'Read one sentence out loud to {person}',  icon: '📖' },
  { text: 'Say your name nice and slow',             icon: '🐢' },
  { text: 'Use a stretchy word today',               icon: '🌈' },
  { text: 'Take a deep breath before talking',       icon: '💨' },
  { text: 'Tell {person} about {thing}',             icon: '💬' },
  { text: 'Ask {person} a question',                 icon: '❓' },
  { text: 'Say hello to someone new',                icon: '👋' },
  { text: 'Order something for yourself',            icon: '🍦' },
  { text: 'Tell {person} how you are feeling',       icon: '💛' },
  { text: 'Answer the phone if it rings',            icon: '📞' },
  { text: 'Tell a joke to {person}',                 icon: '😄' },
];

// Conversation-level prompts for Talk Together. This is the step the app was
// missing entirely: it had isolated words and canned phrases, then jumped
// straight to "ask your teacher a question". Real transfer happens in the
// middle, in actual back-and-forth talking with a person.
const TALK_TEMPLATES = [
  'Tell them one thing that happened today',
  'Ask them what their favourite {food} is',
  'Tell them about {thing}',
  'Ask them about when they were little',
  'Tell them a joke',
  'Ask them what they are doing tomorrow',
  'Tell them something you are good at',
  'Ask them to tell you a story',
  'Tell them where you would go if you could go anywhere',
  'Ask them what makes them laugh',
  'Tell them about your favourite {place}',
  'Ask them what they had for breakfast',
  'Tell them three words that describe you',
  'Ask them to guess what you are thinking of',
  'Tell them what you want to do at the weekend',
  'Ask them what their favourite animal is',
  'Tell them about someone you like spending time with',
  'Ask them what they were {fun} at when they were your age',
];

// ── Seeded selection ───────────────────────────────────────
// mulberry32: small, fast, and good enough for picking words.
function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed that is stable for the whole local day and different tomorrow. */
export function todaySeed(d = new Date(), salt = 0) {
  return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) + salt * 7919;
}

/** Pick n distinct items, deterministically for a given seed. */
export function pick(bank, n, seed) {
  const rng = rngFrom(seed);
  const pool = [...bank];
  const out = [];
  while (out.length < Math.min(n, pool.length)) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

function fill(text, rng) {
  const used = new Set();
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const bank = SLOTS[key];
    if (!bank) return key;
    // Avoid "I like dinosaurs and dinosaurs".
    for (let i = 0; i < 8; i++) {
      const v = bank[Math.floor(rng() * bank.length)];
      if (!used.has(v)) { used.add(v); return v; }
    }
    return bank[0];
  });
}

// ── Today's material ───────────────────────────────────────
export function dailyGentleWords(n = 10, seed = todaySeed(new Date(), 1)) {
  return pick(GENTLE_BANK, n, seed);
}

export function dailyPowerWords(n = 10, seed = todaySeed(new Date(), 2)) {
  return pick(POWER_BANK, n, seed);
}

export function dailyPacingSets(perLevel = 5, seed = todaySeed(new Date(), 3)) {
  return [1, 2, 3, 4].map((syl, i) => ({
    words: pick(PACING_BANK[syl], perLevel, seed + i),
  }));
}

export function dailyStretchPhrases(n = 6, seed = todaySeed(new Date(), 4)) {
  const rng = rngFrom(seed);
  return pick(STRETCH_TEMPLATES, n, seed).map(p => ({ ...p, text: fill(p.text, rng) }));
}

export function dailyPauseSentences(n = 5, seed = todaySeed(new Date(), 5)) {
  const rng = rngFrom(seed);
  return pick(PAUSE_TEMPLATES, n, seed).map(s => ({ ...s, text: fill(s.text, rng) }));
}

export function dailyChallenges(n = 3, seed = todaySeed(new Date(), 6)) {
  const rng = rngFrom(seed);
  return pick(CHALLENGE_TEMPLATES, n, seed).map((c, i) => ({
    id: seed * 10 + i,
    text: fill(c.text, rng),
    icon: c.icon,
    done: false,
  }));
}

export function dailyTalkPrompts(n = 6, seed = todaySeed(new Date(), 7)) {
  const rng = rngFrom(seed);
  return pick(TALK_TEMPLATES, n, seed).map(t => fill(t, rng));
}
