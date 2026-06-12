// game-state.js
// Core game state, storage, and generic helpers.
// This file deliberately avoids any direct DOM access so it
// can be reused or tested without a browser environment.

// ---------- State ----------
export const state = {
  players: [],
  bets: [],
  pot: 0,

  // Currently selected park for theming ('' | 'mk' | 'epcot' | 'hs' | 'dak').
  park: '',

  // Configurable bonus definitions used by bonus helpers.
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
  // Flat log of every bonus that’s been awarded.
  awardedBonuses: []
};

export const STORAGE_KEY = 'disney-line-bet-v1';

// ---------- Small helpers ----------

// Generate a short unique-ish id for players / bets / bonuses.
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Clamp scores to a non-negative integer.
export function clampScore(x) {
  return Math.max(0, Math.round(x));
}

// Basic HTML escaping for any interpolated text.
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

// In some places we want a single “toast-like” notification.
// This helper only manipulates the DOM; it’s generic enough
// that UI code can safely use it.
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

// Simple non-mutating Fisher–Yates shuffle.
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Persist the entire state object into localStorage.
export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (e.g., private mode).
  }
}

// Load state from localStorage and hydrate the in-memory object.
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
    state.park = parsed.park || '';
  } catch {
    // Corrupt data? Just fall back to defaults.
  }
}

// Utility to find how many points a player can spend this round.
export function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
}

// Resolve a player name from id, helpful for display text.
export function getPlayerName(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

// Ensure the Hunny Pot never drops below the number of players.
// Called after mutating pot so the “floor” stays consistent.
export function enforceMinPot() {
  const minPot = state.players.length;
  if (state.pot < minPot) {
    state.pot = minPot;
  }
}
