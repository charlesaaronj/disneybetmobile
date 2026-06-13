// ============================================================
// game-state.js
// Who Said Diz — core state, persistence, and pure utilities.
//
// Rules for this file:
//   - NO direct DOM access (one historical exception: alertLike,
//     which has been removed and moved to ui.js).
//   - NO game logic (point math, round resolution, bonus rules).
//   - Safe to import in Node.js / test environments.
//
// Exports:
//   state          — the single source of truth for the app
//   STORAGE_KEY    — localStorage key (bump version on schema change)
//   uid()          — short unique ID generator
//   clampScore()   — non-negative integer clamp
//   escapeHtml()   — HTML entity escaper for interpolated strings
//   shuffle()      — non-mutating Fisher-Yates shuffle
//   saveState()    — persist state to localStorage
//   loadState()    — hydrate state from localStorage with validation
//   getAvailablePoints() — how many points a player can wager
//   getPlayerName()      — resolve a player name from their id
//   enforceMinPot()      — keep pot at or above player-count floor
// ============================================================


// ============================================================
// STATE
// The single in-memory object that drives the entire app.
// ui.js reads from this; game-logic.js mutates it.
// saveState() / loadState() sync it with localStorage.
// ============================================================

export const state = {
  // Array of player objects:
  // { id, name, startingPoints, currentPoints }
  players: [],

  // Array of bet (round) objects.
  // Each bet moves through: 'answering' → 'guessing' → 'resolved'
  bets: [],

  // Shared Hunny Pot point balance.
  // Always kept at or above state.players.length via enforceMinPot().
  pot: 0,

  // Configurable bonus definitions.
  // These are displayed in the Bonus Library and used by
  // computeBonusPointsForRound() in game-logic.js.
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

  // Flat log of every bonus that has been awarded this session.
  // Prepended (unshift) so newest appears first.
  awardedBonuses: []
};


// ============================================================
// STORAGE KEY
// Versioned so old localStorage saves don't silently break the
// app when new fields are added to the state schema.
// IMPORTANT: bump this (e.g. 'v2') whenever you add required
// fields to player or bet objects that old saves won't have.
// ============================================================

export const STORAGE_KEY = 'disney-line-bet-v1';


// ============================================================
// uid()
// Generate a short, random, base-36 ID.
// Sufficient for a local single-session game (players + bets).
// Uses a timestamp seed + random suffix to reduce collision risk
// across page reloads within the same session.
//
// NOTE: not cryptographically unique. If you ever need globally
// unique IDs (e.g. server sync), replace with crypto.randomUUID().
// ============================================================

let _uidCounter = Date.now();

export function uid() {
  // Monotonically incrementing counter seeded at page load time.
  // Produces readable, sortable IDs like '1qx3k2a'.
  return (++_uidCounter).toString(36);
}


// ============================================================
// clampScore(x)
// Ensure a point value is always a non-negative integer.
// Used everywhere points are assigned or modified.
// ============================================================

export function clampScore(x) {
  return Math.max(0, Math.round(x));
}


// ============================================================
// escapeHtml(value)
// Escape the five dangerous HTML characters before interpolating
// any user-supplied string into innerHTML.
// Used in ui.js render functions; kept here so game-logic.js
// can also use it for any display strings it builds.
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
// Used to randomize answer order and wager order each round.
// ============================================================

export function shuffle(array) {
  const arr = array.slice(); // copy so the original is untouched
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ============================================================
// saveState()
// Serialize the entire state object into localStorage.
// Called after every mutation in game-logic.js.
// Silently swallows errors (private/incognito mode, quota exceeded).
// ============================================================

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota exceeded) — ignore.
    // The game continues in memory; data won't persist across reloads.
  }
}


// ============================================================
// loadState()
// Hydrate in-memory state from localStorage on page load.
//
// FIX: previously assigned parsed arrays directly without
// validating individual object shapes. Old saves missing new
// fields (e.g. adjustmentsApplied, computedBonuses) would cause
// silent runtime errors. Now each player and bet is passed
// through a defaults merge before being accepted.
//
// Called once from ui.js on the 'load' event, before render().
// ============================================================

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return; // no save found — use initial defaults

    const parsed = JSON.parse(raw);

    // Bail out if the save is structurally invalid.
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;

    // --- Players ---
    // Merge each saved player with safe defaults so missing fields
    // from older save versions don't cause undefined errors at runtime.
    state.players = parsed.players.map(p => ({
      id:             p.id             || uid(),
      name:           p.name           || 'Unknown',
      startingPoints: clampScore(p.startingPoints ?? 10),
      currentPoints:  clampScore(p.currentPoints  ?? p.startingPoints ?? 10)
    }));

    // --- Bets ---
    // Merge each saved bet with safe defaults. New fields added to
    // the bet schema (e.g. adjustmentsApplied, scoreChanges) will
    // default to safe values rather than undefined.
    state.bets = parsed.bets.map(b => ({
      id:                  b.id                  || uid(),
      index:               b.index               ?? 0,
      description:         b.description         || '',
      createdAt:           b.createdAt           || '',
      attraction:          b.attraction          || '',
      land:                b.land                || '',
      status:              b.status              || 'resolved',
      answers:             Array.isArray(b.answers)       ? b.answers       : [],
      chosenAnswerId:      b.chosenAnswerId      || null,
      correctAuthorId:     b.correctAuthorId     || null,
      correctAuthors:      Array.isArray(b.correctAuthors) ? b.correctAuthors : [],
      guesses:             Array.isArray(b.guesses)        ? b.guesses        : [],
      roundWinners:        Array.isArray(b.roundWinners)   ? b.roundWinners   : [],
      bonusAwards:         Array.isArray(b.bonusAwards)    ? b.bonusAwards    : [],
      answerOrder:         Array.isArray(b.answerOrder)    ? b.answerOrder    : [],
      wagerOrder:          Array.isArray(b.wagerOrder)     ? b.wagerOrder     : [],
      ghostAnswerUsed:     b.ghostAnswerUsed     ?? false,
      hotRound:            b.hotRound            ?? false,
      hotRoundBonus:       clampScore(b.hotRoundBonus ?? 0),
      resolvedAt:          b.resolvedAt          || null,
      scoreChanges:        Array.isArray(b.scoreChanges)   ? b.scoreChanges   : [],
      // FIX: idempotency guard for applyRoundAdjustments (game-logic.js).
      // If a saved bet already had adjustments applied, this prevents
      // re-applying them if the adjustments modal is opened again.
      adjustmentsApplied:  b.adjustmentsApplied  ?? false,
      cachedAdjustments:   b.cachedAdjustments   ?? null,
      // Cache for computeBonusPointsForRound to avoid O(n²) rescanning.
      computedBonuses:     b.computedBonuses      ?? null
    }));

    // --- Scalar fields ---
    state.pot           = clampScore(Number(parsed.pot) || 0);
    state.bonuses       = Array.isArray(parsed.bonuses)
                            ? parsed.bonuses
                            : state.bonuses; // fall back to hardcoded defaults
    state.awardedBonuses = Array.isArray(parsed.awardedBonuses)
                            ? parsed.awardedBonuses
                            : [];

  } catch {
    // Corrupt or unparseable save data — silently fall back to defaults.
    // The player will start fresh rather than seeing a crash.
  }
}


// ============================================================
// getAvailablePoints(playerId)
// How many points a player can wager in the current round.
// Returns 0 if the player is not found.
// Used by normalizeGuesses() and attachWagerGuards() in ui.js.
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
// Ensure the Hunny Pot never drops below the number of players.
// This keeps a small pot available for catch-up and Hot Rounds
// even after players wager all their points.
//
// Called after every pot mutation (addToPot, giveFromPot,
// clearPot, resolveGuessingBet, applyRoundAdjustments).
//
// Returns true if the pot was changed, false if it was already
// at or above the minimum. The return value lets callers decide
// whether to call saveState() after enforcing.
// ============================================================

export function enforceMinPot() {
  const minPot = state.players.length;
  if (state.pot < minPot) {
    state.pot = minPot;
    return true; // pot was changed
  }
  return false; // pot was already fine
}
