// state.js
// Central game state, persistent storage, and small utilities.

export const STORAGE_KEY = 'disney-line-bet-v1';

// All mutable game state lives here so every module shares a single source of truth.
export const state = {
  players: [],
  bets: [],
  pot: 0,

  bonuses: [
    {
      id: 'noGuessAuthor',
      name: 'No one guessed the author',
      points: 3,
      active: true,
      description: 'If nobody guesses correctly, the real author gets +3 points.'
    },
    {
      id: 'streak3',
      name: '3 wins in a row',
      points: 3,
      active: true,
      description: 'Award when a player has won 3 resolved rounds in a row.'
    },
    {
      id: 'multiLand',
      name: 'Multiple wins in a single land',
      points: 2,
      active: true,
      description: 'Award when a player has multiple wins in the same land.'
    }
  ],
  awardedBonuses: []
};

// ----- Small helpers -----

// Cheap unique id for rounds/players/bonus awards.
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Clamp a score to a non‑negative integer.
export function clampScore(x) {
  return Math.max(0, Math.round(x));
}

// Basic HTML escaping for user-facing strings.
export function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

// Fisher–Yates clone‑and‑shuffle.
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Toast-style, non-blocking notification.
export function alertLike(message) {
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    zIndex: 999,
    padding: '10px 14px',
    borderRadius: '999px',
    background: '#000',
    color: '#fff',
    maxWidth: '90vw',
    textAlign: 'center'
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ----- Persistence -----

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;

    state.players = parsed.players;
    state.bets = parsed.bets;
    state.pot = Number(parsed.pot) || 0;
    state.bonuses = parsed.bonuses || state.bonuses || [];
    state.awardedBonuses = parsed.awardedBonuses || [];
  } catch {}
}

// Ensure the Hunny Pot never drops below the number of players.
export function enforceMinPot() {
  const minPot = state.players.length;
  if (state.pot < minPot) {
    state.pot = minPot;
  }
}

// Convenience lookup helpers.

export function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
}

export function getPlayerName(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}
