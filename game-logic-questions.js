// ============================================================
// game-logic-questions.js
// Who Said Diz — question bank helpers and auto-bonus rules.
//
// Rules for this file:
//   - NO direct DOM access.
//   - NO point mutation (read state only).
//   - Safe to import in any environment.
//
// Exports:
//   getRandomUnusedGlobalQuestion()
//   getRandomQuestionForAttraction()
//   getRandomQuestionForAttractionWithFallback()
//   computeBonusPointsForRound()
// ============================================================

import {
  state,
  uid
} from './game-state.js';


// ============================================================
// QUESTION BANK HELPERS
// These rely on window.QUESTIONS being defined by questions.js
// loaded as a plain <script> before this module.
// ============================================================

// Return a random global (non-attraction-specific) question that
// has not already been used as a round description this session.
// Returns null if all questions have been used.
export function getRandomUnusedGlobalQuestion() {
  if (!window.QUESTIONS || !Array.isArray(window.QUESTIONS.global)) return null;

  const used = new Set(state.bets.map(b => b.description));
  const pool = window.QUESTIONS.global.filter(q => !used.has(q));

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Return a random question from a specific attraction's question
// pool. Returns null if no questions exist for that attraction.
export function getRandomQuestionForAttraction(attractionName) {
  if (!window.QUESTIONS || !Array.isArray(window.QUESTIONS.byAttraction)) return null;

  const normalized = attractionName.trim().toLowerCase();
  const entry = window.QUESTIONS.byAttraction.find(
    a => a.name.trim().toLowerCase() === normalized
  );

  if (!entry || !Array.isArray(entry.questions) || !entry.questions.length) return null;

  const idx = Math.floor(Math.random() * entry.questions.length);
  return entry.questions[idx];
}

// Return a question for a specific attraction.
// If no attraction-specific question exists, fall back to a random
// global question that hasn't been used yet.
export function getRandomQuestionForAttractionWithFallback(attractionName) {
  return getRandomQuestionForAttraction(attractionName)
    || getRandomUnusedGlobalQuestion();
}


// ============================================================
// AUTO-BONUS RULES
// Called by applyRoundAdjustments() in game-logic-rounds.js
// when state.gameOptions.autoBonuses is true.
//
// Returns an array of bonus award objects:
//   { playerId, amount, reason }
//
// Does NOT mutate state — caller applies the awards.
// ============================================================

export function computeBonusPointsForRound(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return [];

  const bonuses = [];

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  const guesses      = bet.guesses || [];
  const activeBonuses = state.bonuses.filter(b => b.active);


  // ---- 1. Hidden author bonus ----
  // If nobody guessed the correct author, award the author +N points.
  const hiddenBonus = activeBonuses.find(b => b.id === 'noGuessAuthor');
  if (hiddenBonus && correctAuthors.length) {
    const guessedAuthorIds = new Set(
      guesses
        .filter(g => !correctAuthors.includes(g.playerId)) // exclude authors
        .map(g => g.guessedAuthorId)
        .filter(Boolean)
    );

    correctAuthors.forEach(authorId => {
      if (!guessedAuthorIds.has(authorId)) {
        bonuses.push({
          id:       uid(),
          playerId: authorId,
          amount:   hiddenBonus.points,
          reason:   hiddenBonus.name
        });
        console.log('Auto bonus — hidden author:', authorId, '+' + hiddenBonus.points);
      }
    });
  }


  // ---- 2. Three wins in a row bonus ----
  // If a player has won the last 3 resolved rounds, award +N.
  const streakBonus = activeBonuses.find(b => b.id === 'streak3');
  if (streakBonus) {
    const resolved = state.bets
      .filter(b => b.status === 'resolved')
      .sort((a, b) => (b.index ?? 0) - (a.index ?? 0));

    // Only evaluate if there are at least 3 resolved rounds including this one.
    if (resolved.length >= 3) {
      const last3 = resolved.slice(0, 3);

      state.players.forEach(player => {
        const wonAll3 = last3.every(b =>
          Array.isArray(b.roundWinners) && b.roundWinners.includes(player.id)
        );

        // Only award on the 3rd win exactly (not on subsequent consecutive wins)
        // to avoid re-awarding the bonus every round after a streak starts.
        const wonRound4 = resolved[3]
          ? resolved[3].roundWinners?.includes(player.id)
          : false;

        if (wonAll3 && !wonRound4) {
          bonuses.push({
            id:       uid(),
            playerId: player.id,
            amount:   streakBonus.points,
            reason:   streakBonus.name
          });
          console.log('Auto bonus — streak3:', player.name, '+' + streakBonus.points);
        }
      });
    }
  }


  // ---- 3. Multiple wins in a single land bonus ----
  // If a player has won 2+ rounds set in the same land this session,
  // award +N once per qualifying land (only on the round that hits 2).
  const multiLandBonus = activeBonuses.find(b => b.id === 'multiLand');
  if (multiLandBonus) {
    const resolved = state.bets
      .filter(b => b.status === 'resolved' && b.land)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    state.players.forEach(player => {
      // Build a map of land → win count for this player across all resolved rounds.
      const landWins = {};
      resolved.forEach(b => {
        if (Array.isArray(b.roundWinners) && b.roundWinners.includes(player.id)) {
          const land = b.land.trim().toLowerCase();
          landWins[land] = (landWins[land] || 0) + 1;
        }
      });

      // Award the bonus for this round if THIS round was the 2nd win in its land.
      const thisLand = bet.land?.trim().toLowerCase();
      if (
        thisLand &&
        Array.isArray(bet.roundWinners) &&
        bet.roundWinners.includes(player.id) &&
        landWins[thisLand] === 2
      ) {
        bonuses.push({
          id:       uid(),
          playerId: player.id,
          amount:   multiLandBonus.points,
          reason:   multiLandBonus.name
        });
        console.log('Auto bonus — multiLand:', player.id, '+' + multiLandBonus.points, 'land:', thisLand);
      }
    });
  }

  return bonuses;
}
