// ============================================================
// game-state.js
// Who Said Diz — core state, persistence, and pure utilities.
//
// Rules for this file:
//   - NO direct DOM access.
//   - NO game logic (point math, round resolution, bonus rules).
//   - Safe to import in any environment.
//
// Exports:
//   state                — single source of truth
//   STORAGE_KEY          — localStorage key
//   DEFAULT_OPTIONS      — default game options per mode
//   uid()                — short unique ID generator
//   clampScore()         — non-negative integer clamp
//   escapeHtml()         — HTML entity escaper
//   shuffle()            — non-mutating Fisher-Yates shuffle
//   saveState()          — persist to localStorage
//   loadState()          — hydrate from localStorage
//   getAvailablePoints() — how many points a player can wager
//   getPlayerName()      — resolve player name from id
//   enforceMinPot()      — keep pot at or above player-count floor
// ============================================================


// ============================================================
// DEFAULT GAME OPTIONS
// Each mode is a preset of the five toggleable options.
// 'custom' starts with the competitive defaults and lets the
// family override each one individually.
//
// Options:
//   tableStakes    — all active players must wager the same amount
//   catchUp        — pot transfers to last place when gap >= 10
//   hotRounds      — offer extra pot bonus before each round
//   autoBonuses    — award hidden author / streak / multi-land bonuses
//   authorsWager   — authors gain/lose points on their own wager
//                    (always false; included for completeness)
// ============================================================

export const DEFAULT_OPTIONS = {
  simple: {
    tableStakes:  false,
    catchUp:      true,
    hotRounds:    false,
    autoBonuses:  false,
    authorsWager: false
  },
  competitive: {
    tableStakes:  true,
    catchUp:      false,
    hotRounds:    true,
    autoBonuses:  true,
    authorsWager: false
  },
  custom: {
    // Custom starts with competitive defaults;
    // the family overrides each toggle on the setup screen.
    tableStakes:  true,
    catchUp:      false,
    hotRounds:    true,
    autoBonuses:  true,
    authorsWager: false
  }
};


// ============================================================
// STATE
// The single in-memory object that drives the entire app.
// ui.js reads from this; game-logic-rounds.js mutates it.
// saveState() / loadState() sync it with localStorage.
// ============================================================

export const state = {
  // Array of player objects:
  // { id, name, startingPoints, currentPoints }
  players: [],

  // Array of bet (round) objects.
  // Each bet moves through: answering → guessing → resolved
  bets: [],

  // Shared Hunny Pot point balance.
  pot: 0,

  // Active game mode: 'simple' | 'competitive' | 'custom'
  // Set on the setup screen before starting a game.
  gameMode: 'competitive',

  // Active game options — copied from DEFAULT_OPTIONS[gameMode]
  // when a mode is selected, then overrideable in custom mode.
  gameOptions: { ...DEFAULT_OPTIONS.competitive },

  // Configurable bonus definitions.
  bonuses: [
    {
      id:          'noGuessAuthor',
      name:        'No one guessed the author',
      points:      3,
      active:      true,
      description: 'If nobody guesses correctly, the real author gets +3 points.'
    },
    {
      id:          'streak3',
      name:        '3 wins in a row',
      points:      3,
      active:      true,
      description: 'Award when a player has won 3 resolved rounds in a row.'
    },
    {
      id:          'multiLand',
      name:        'Multiple wins in a single land',
      points:      2,
      active:      true,
      description: 'Award when a player has multiple wins in the same land.'
    }
  ],

  // Flat log of every bonus awarded this session.
  // Prepended (unshift) so newest appears first.
  awardedBonuses: []
};


// ============================================================
// STORAGE KEY
// Bump the version string whenever the state schema changes
// in a way that would break old saves (e.g. new required fields).
// ============================================================

export const STORAGE_KEY = 'disney-line-bet-v2';


// ============================================================
// uid()
// Monotonically incrementing base-36 ID seeded at page load.
// Not cryptographically unique — fine for a local session game.
// ============================================================

let _uidCounter = Date.now();

export function uid() {
  return (++_uidCounter).toString(36);
}


// ============================================================
// clampScore(x)
// Ensure a point value is always a non-negative integer.
// ============================================================

export function clampScore(x) {
  return Math.max(0, Math.round(x));
}


// ============================================================
// escapeHtml(value)
// Escape the five dangerous HTML characters before interpolating
// any user-supplied string into innerHTML.
// ============================================================

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}


// ============================================================
// shuffle(array)
// Non-mutating Fisher-Yates shuffle.
// Returns a new array; the original is never modified.
// ============================================================

export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ============================================================
// saveState()
// Serialize state to localStorage.
// Silently swallows errors (private mode, quota exceeded).
// ============================================================

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — game continues in memory only.
  }
}


// ============================================================
// loadState()
// Hydrate in-memory state from localStorage on page load.
// Each object is merged with safe defaults so missing fields
// from older saves never cause runtime errors.
// ============================================================

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;

    // --- Players ---
    state.players = parsed.players.map(p => ({
      id:             p.id             || uid(),
      name:           p.name           || 'Unknown',
      startingPoints: clampScore(p.startingPoints ?? 10),
      currentPoints:  clampScore(p.currentPoints  ?? p.startingPoints ?? 10)
    }));

    // --- Bets ---
    state.bets = parsed.bets.map(b => ({
      id:                  b.id                  || uid(),
      index:               b.index               ?? 0,
      description:         b.description         || '',
      createdAt:           b.createdAt           || '',
      attraction:          b.attraction          || '',
      land:                b.land                || '',
      status:              b.status              || 'resolved',
      answers:             Array.isArray(b.answers)        ? b.answers        : [],
      chosenAnswerId:      b.chosenAnswerId       || null,
      correctAuthorId:     b.correctAuthorId      || null,
      correctAuthors:      Array.isArray(b.correctAuthors) ? b.correctAuthors : [],
      guesses:             Array.isArray(b.guesses)        ? b.guesses        : [],
      roundWinners:        Array.isArray(b.roundWinners)   ? b.roundWinners   : [],
      bonusAwards:         Array.isArray(b.bonusAwards)    ? b.bonusAwards    : [],
      answerOrder:         Array.isArray(b.answerOrder)    ? b.answerOrder    : [],
      wagerOrder:          Array.isArray(b.wagerOrder)     ? b.wagerOrder     : [],
      ghostAnswerUsed:     b.ghostAnswerUsed      ?? false,
      hotRound:            b.hotRound             ?? false,
      hotRoundBonus:       clampScore(b.hotRoundBonus ?? 0),
      resolvedAt:          b.resolvedAt           || null,
      scoreChanges:        Array.isArray(b.scoreChanges)   ? b.scoreChanges   : [],
      adjustmentsApplied:  b.adjustmentsApplied   ?? false,
      cachedAdjustments:   b.cachedAdjustments    ?? null,
      computedBonuses:     b.computedBonuses       ?? null
    }));

    // --- Scalar fields ---
    state.pot  = clampScore(Number(parsed.pot) || 0);

    // --- Game mode & options ---
    // Validate saved mode; fall back to 'competitive' if unrecognised.
    const validModes = ['simple', 'competitive', 'custom'];
    state.gameMode = validModes.includes(parsed.gameMode)
      ? parsed.gameMode
      : 'competitive';

    // Merge saved options with the mode defaults so missing keys
    // from older saves are filled in safely.
    state.gameOptions = {
      ...DEFAULT_OPTIONS[state.gameMode],
      ...(parsed.gameOptions || {})
    };

    // authorsWager is always false — never load a true value from saves.
    state.gameOptions.authorsWager = false;

    // --- Bonuses & awarded bonuses ---
    state.bonuses = Array.isArray(parsed.bonuses)
      ? parsed.bonuses
      : state.bonuses;

    state.awardedBonuses = Array.isArray(parsed.awardedBonuses)
      ? parsed.awardedBonuses
      : [];

  } catch {
    // Corrupt save — silently fall back to defaults.
  }
}


// ============================================================
// getAvailablePoints(playerId)
// How many points a player can wager in the current round.
// Returns 0 if the player is not found.
// ============================================================

export function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
}


// ============================================================
// getPlayerName(id)
// Resolve a display name from a player ID.
// Returns 'Unknown' if the player has been removed mid-game.
// ============================================================

export function getPlayerName(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}


// ============================================================
// enforceMinPot()
// Keep the Hunny Pot at or above the number of players.
// Returns true if the pot was changed, false if already fine.
// ============================================================

export function enforceMinPot() {
  const minPot = state.players.length;
  if (state.pot < minPot) {
    state.pot = minPot;
    return true;
  }
  return false;
}
