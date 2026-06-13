// ============================================================
// game-logic-questions.js
// Who Said Diz — park data helpers, question selection,
// and automatic bonus computation.
//
// Separated from game-logic-rounds.js to keep each file
// focused on one concern. This file knows about attractions,
// lands, question pools, and the rules for earning bonuses.
// It does not move points or advance round status.
//
// Exports:
//   getUsedSpecificQuestionsForAttraction() — used question tracking
//   getUsedGlobalQuestions()                — used global question tracking
//   getRandomUnusedGlobalQuestion()         — pick a fresh global question
//   getRandomQuestionForAttractionWithFallback() — attraction-first picker
//   getFactForBet()                         — fun fact for a round
//   computeBonusPointsForRound()            — automatic bonus rules
//   getResolvedWinsForPlayer()              — win history for a player
// ============================================================

import {
  state
} from './game-state.js';


// ============================================================
// PARK DATA HELPERS
// All park/attraction data lives in window.PARKS (parks-data.js).
// These helpers encapsulate the lookup logic so the rest of the
// codebase never directly accesses window.PARKS.
// ============================================================

// Return the Set of attraction-specific questions already used
// for a given attraction name (case-insensitive).
export function getUsedSpecificQuestionsForAttraction(attractionName) {
  const parks      = window.PARKS;
  if (!parks || !Array.isArray(parks.attractions)) return new Set();

  const attraction = parks.attractions.find(
    a => a.name.toLowerCase() === attractionName.toLowerCase()
  );
  if (!attraction || !Array.isArray(attraction.questions)) return new Set();

  const specificQuestions = new Set(attraction.questions);
  const used              = new Set();

  state.bets
    .filter(b => b.description && b.attraction)
    .forEach(bet => {
      if (
        bet.attraction.toLowerCase() === attractionName.toLowerCase() &&
        specificQuestions.has(bet.description)
      ) {
        used.add(bet.description);
      }
    });

  return used;
}

// Return the Set of global questions already used at least once
// this session. Used to prefer unused questions when randomizing.
export function getUsedGlobalQuestions() {
  const globalPool = new Set(window.DISNEY_LINE_QUESTIONS || []);
  const used       = new Set();

  state.bets
    .filter(b => b.description)
    .forEach(bet => {
      if (globalPool.has(bet.description)) used.add(bet.description);
    });

  return used;
}

// Return a random global question that has not been used yet.
// Falls back to any random global question if all have been used.
// Returns an empty string if no global questions are defined.
export function getRandomUnusedGlobalQuestion() {
  const globalPool  = window.DISNEY_LINE_QUESTIONS || [];
  if (!globalPool.length) return '';

  const usedGlobal  = getUsedGlobalQuestions();
  const unusedGlobal = globalPool.filter(q => !usedGlobal.has(q));

  const pool = unusedGlobal.length ? unusedGlobal : globalPool;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Return a question for a given attraction, preferring:
//   1. Unused attraction-specific questions
//   2. Any global question (if no specific ones remain)
// Falls back to a random global question if attraction is blank.
export function getRandomQuestionForAttractionWithFallback(attractionName) {
  const name = attractionName?.trim();

  if (!name) {
    const pool = window.DISNEY_LINE_QUESTIONS || [];
    if (!pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const parks      = window.PARKS;
  const attractions = parks && Array.isArray(parks.attractions)
    ? parks.attractions
    : [];

  const attraction  = attractions.find(
    a => a.name.toLowerCase() === name.toLowerCase()
  );

  const specific    = attraction && Array.isArray(attraction.questions)
    ? attraction.questions
    : [];

  const usedSpecific  = getUsedSpecificQuestionsForAttraction(name);
  const unusedSpecific = specific.filter(q => !usedSpecific.has(q));

  if (unusedSpecific.length) {
    return unusedSpecific[Math.floor(Math.random() * unusedSpecific.length)];
  }

  // All specific questions used — fall back to global pool.
  const globalPool = window.DISNEY_LINE_QUESTIONS || [];
  if (!globalPool.length) return '';
  return globalPool[Math.floor(Math.random() * globalPool.length)];
}

// Return a fun fact string for the attraction in a given bet.
// Returns an empty string if no fact is defined.
export function getFactForBet(bet) {
  if (!bet?.attraction) return '';

  const parks       = window.PARKS;
  const attractions = parks && Array.isArray(parks.attractions)
    ? parks.attractions
    : [];

  const attraction  = attractions.find(
    a => a.name.toLowerCase() === bet.attraction.toLowerCase()
  );

  return attraction?.fact || '';
}


// ============================================================
// BONUS COMPUTATION
// Computes which automatic bonuses should be awarded for a
// specific resolved round. Called by applyRoundAdjustments()
// in game-logic-rounds.js.
//
// Results are cached on bet.computedBonuses after the first
// call so subsequent calls (e.g. from a re-opened modal) do
// not rescan the entire bet history.
//
// Three automatic bonus rules:
//   1. Hidden author  — no one guessed the correct author (+3)
//   2. Three in a row — player won 3 consecutive rounds (+3)
//   3. Multi-land     — player's SECOND win in a new land (+2)
//                       (only awarded once per land per player)
//
// Returns an array of { playerId, amount, reason }.
// ============================================================

export function computeBonusPointsForRound(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return [];

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  const guesses = bet.guesses || [];
  const bonuses = [];

  // ---- Bonus 1: Hidden author ----
  // The correct author gets +3 if nobody guessed them.
  if (correctAuthors.length) {
    const guessedIds = new Set(guesses.map(g => g.guessedAuthorId).filter(Boolean));
    correctAuthors.forEach(authorId => {
      if (!guessedIds.has(authorId)) {
        bonuses.push({
          playerId: authorId,
          amount:   3,
          reason:   'Hidden author (no one guessed them)'
        });
      }
    });
  }

  // ---- Bonus 2: Three consecutive wins ----
  // Get all resolved rounds in chronological order.
  const resolved = state.bets
    .filter(b => b.status === 'resolved')
    .sort((a, b) => new Date(a.resolvedAt || a.createdAt) - new Date(b.resolvedAt || b.createdAt));

  const idx = resolved.findIndex(b => b.id === betId);

  if (idx >= 2) {
    const lastThree = resolved.slice(idx - 2, idx + 1);

    state.players.forEach(({ id: pid }) => {
      const allThreeCorrect = lastThree.every(round => {
        const rCorrect = round.correctAuthors?.length
          ? round.correctAuthors
          : (round.correctAuthorId ? [round.correctAuthorId] : []);
        return (round.guesses || []).some(
          g => g.playerId === pid && rCorrect.includes(g.guessedAuthorId)
        );
      });

      if (allThreeCorrect) {
        bonuses.push({ playerId: pid, amount: 3, reason: 'Three wins in a row' });
      }
    });
  }

  // ---- Bonus 3: Multi-land ----
  // FIX: previously awarded on every subsequent win in a land.
  // Now only awards exactly when a player crosses from 1 win to
  // 2 wins in different attractions within the same land.
  if (bet.land) {
    const land = bet.land;

    // All resolved rounds in this land, including the current one.
    const resolvedInLand = state.bets.filter(
      b => b.status === 'resolved' && b.land === land
    );

    // All resolved rounds in this land BEFORE the current one.
    const resolvedInLandBefore = resolvedInLand.filter(b => b.id !== betId);

    state.players.forEach(({ id: pid }) => {

      // Attractions where this player won BEFORE this round.
      const attractionsBeforeThisRound = new Set();
      resolvedInLandBefore.forEach(round => {
        const rCorrect = round.correctAuthors?.length
          ? round.correctAuthors
          : (round.correctAuthorId ? [round.correctAuthorId] : []);
        const won = (round.guesses || []).some(
          g => g.playerId === pid && rCorrect.includes(g.guessedAuthorId)
        );
        if (won && round.attraction) attractionsBeforeThisRound.add(round.attraction);
      });

      // Did this player win the current round?
      const wonThisRound = (bet.guesses || []).some(
        g => g.playerId === pid && correctAuthors.includes(g.guessedAuthorId)
      );

      if (!wonThisRound) return;

      // Attractions including this round.
      const attractionsIncludingNow = new Set(attractionsBeforeThisRound);
      if (bet.attraction) attractionsIncludingNow.add(bet.attraction);

      // Award only when crossing from exactly 1 unique attraction
      // win to 2 — i.e., this is the first multi-attraction win.
      if (
        attractionsBeforeThisRound.size === 1 &&
        attractionsIncludingNow.size === 2
      ) {
        bonuses.push({
          playerId: pid,
          amount:   2,
          reason:   `Multiple wins in ${land}`
        });
      }
    });
  }

  return bonuses;
}


// ============================================================
// WIN HISTORY
// Return all resolved rounds a player has won, oldest first.
// Used externally if win streaks or history need to be
// displayed outside of the bonus computation context.
// ============================================================

export function getResolvedWinsForPlayer(playerId) {
  return state.bets
    .filter(b =>
      b.status === 'resolved' &&
      (b.roundWinners || []).includes(playerId)
    )
    .sort((a, b) => new Date(a.resolvedAt) - new Date(b.resolvedAt));
}
