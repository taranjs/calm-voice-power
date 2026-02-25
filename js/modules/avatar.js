// js/modules/avatar.js
export const AVATARS = [
  { id: '🐱', cost: 0,   label: 'Kitty' },
  { id: '🐶', cost: 0,   label: 'Puppy' },
  { id: '🦊', cost: 20,  label: 'Fox' },
  { id: '🐸', cost: 30,  label: 'Frog' },
  { id: '🦁', cost: 50,  label: 'Lion' },
  { id: '🐨', cost: 60,  label: 'Koala' },
  { id: '🦄', cost: 100, label: 'Unicorn' },
  { id: '🐉', cost: 150, label: 'Dragon' },
  { id: '🚀', cost: 200, label: 'Rocket' },
];

export const BODY_PARTS = {
  hair:  ['🎀', '👒', '🎩', '⭐', '🌈', '🌸'],
  eyes:  ['😊', '😄', '🥰', '😎', '🤩', '😸'],
  accessory: ['🎵', '🌟', '💎', '🎮', '🌈', '❤️'],
};

export function renderAvatarSVG(avatar) {
  return `<span style="font-size:3rem;line-height:1">${avatar.body || '🐱'}</span>`;
}
