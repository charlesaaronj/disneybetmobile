// ============================================================
// game-logic-rounds.js
// Who Said Diz — player management, Hunny Pot, round lifecycle,
// wagering, and round resolution.
//
// This file owns how points move and how rounds advance through
// their three phases: answering → guessing → resolved.
//
// It does NOT touch the DOM. All user-facing messages are
// returned as error strings rather than calling alertLike()
// directly, keeping this file testable outside a browser.
//
// Exports:
//   addPlayer()                 — add a family member
//   removePlayer()              — remove a player safely
//   resetGameKeepingPlayers()   — clear rounds/pot, keep players
//   giveFromPot()               — transfer pot points to a player
//   addToPot()                  — add arbitrary points to pot
//   clearPot()                  — reset pot to zero (floor applies)
//   getCurrentGuessingBet()     — find the active guessing round
//   setChosenAnswerForBet()     — mark a canonical answer
//   chooseRandomAnswerForBet()  — pick a random answer for a bet
//   rerollChosenAnswer()        — swap to a different answer
//   rerollCurrentSelectedAnswer() — reroll the active round
//   finalizeCreateBet()         — build and insert a new round
//   startAnswerPhase()          — reset a round for answering
//   getNextAnswerPrompt()       — advance the answer sequence
//   savePlayerAnswer()          — record one player's answer
//   startGuessPhase()           — initialize guessing phase
//   normalizeGuesses()          — validate + sanitize raw guesses
//   validateTableStakes()       — enforce equal wager rule
//   resolveGuessingBet()        — apply wager payouts (phase 1)
//   applyRoundAdjustments()     — apply bonuses + catch-up (phase 2)
// ============================================================

import {
  state,
  uid,
  clampScore,
  shuffle,
  saveState,
  enforceMinPot,
  getAvailablePoints
} from './game-state.js';

import {
  computeBonusPointsForRound
} from './game-logic-questions.js';


// ============================================================
// PLAYERS
// ============================================================

// Add a new family member with a starting point balance.
export function addPlayer(name, startingPoints) {
  state.players.push({
    id:             uid(),
    name:           name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints:  clampScore(startingPoints)
  });
  enforceMinPot();
  saveState();
}

// Remove a player and clean up any in-progress rounds they
// were part of. Resolved rounds are preserved for history.
//
// FIX: previously deleted entire bets where the player had
// placed any guess, including resolved history. Now only
// strips the player from active (non-resolved) rounds.
export function removePlayer(playerId) {
  // Remove the player from the roster.
  state.players = state.players.filter(p => p.id !== playerId);

  // Clean up active rounds — remove their guess/answer entries
  // but do not delete the round itself.
  state.bets.forEach(bet => {
    if (bet.status === 'resolved') return; // preserve history

    if (bet.guesses) {
      bet.guesses = bet.guesses.filter(g => g.playerId !== playerId);
    }
    if (bet.answerOrder) {
      bet.answerOrder = bet.answerOrder.filter(id => id !== playerId);
    }
    if (bet.wagerOrder) {
      bet.wagerOrder = bet.wagerOrder.filter(id => id !== playerId);
    }
    if (bet.answers) {
      bet.answers = bet.answers.filter(a => a.playerId !== playerId);
    }
  });

  // Remove any in-progress bets that now have fewer than 2 participants.
  state.bets = state.bets.filter(bet => {
    if (bet.status === 'resolved') return true;
    const remaining = (bet.answerOrder || []).filter(id =>
      state.players.some(p => p.id === id)
    );
    return remaining.length >= 2;
  });

  enforceMinPot();
  saveState();
}

// Reset all round data and scores back to starting points.
// Players are kept so the group doesn't need to re-enter names.
export function resetGameKeepingPlayers() {
  state.players.forEach(p => {
    p.currentPoints = clampScore(p.startingPoints || 0);
  });
  state.bets         = [];
  state.pot          = 0;
  state.awardedBonuses = [];
  enforceMinPot();
  saveState();
}


// ============================================================
// HUNNY POT
// ============================================================

// Transfer points from the pot to a specific player.
// Returns an error string on failure, null on success.
export function giveFromPot(playerId, amount) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (state.pot <= 0) return 'No points in the Hunny Pot right now.';

  let amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a number greater than 0.';
  if (amt > state.pot) amt = state.pot; // silently cap to pot total

  state.pot             -= amt;
  player.currentPoints   = clampScore(player.currentPoints + amt);
  enforceMinPot();
  saveState();
  return null; // success
}

// Add arbitrary points into the Hunny Pot.
// Returns an error string on failure, null on success.
export function addToPot(amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a number greater than 0.';
  state.pot += amt;
  enforceMinPot();
  saveState();
  return null; // success
}

// Reset the pot to zero (enforceMinPot will apply the floor).
export function clearPot() {
  if (!state.pot) return;
  state.pot = 0;
  enforceMinPot();
  saveState();
}


// ============================================================
// ROUND HELPERS
// ============================================================

// Return the round currently in "guessing" phase, or null.
// There should only ever be one guessing round at a time.
export function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

// Mark a specific answer as the canonical one for a round.
// If multiple players gave identical text, all are treated
// as correct authors (prevents unfair losses from duplicates).
export function setChosenAnswerForBet(bet, chosen) {
  if (!bet || !chosen) return;

  bet.chosenAnswerId = chosen.id;

  const sameTextAuthors = bet.answers
    .filter(a => a.text === chosen.text)
    .map(a => a.playerId);

  bet.correctAuthors  = sameTextAuthors;
  bet.correctAuthorId = sameTextAuthors[0] || null;
}

// Randomly pick one of the round's answers as the canonical one.
export function chooseRandomAnswerForBet(bet) {
  if (!bet || !Array.isArray(bet.answers) || !bet.answers.length) return;
  const idx    = Math.floor(Math.random() * bet.answers.length);
  setChosenAnswerForBet(bet, bet.answers[idx]);
}

// Swap to a different answer than the currently chosen one.
// Returns the updated bet on success, null on failure.
export function rerollChosenAnswer(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !Array.isArray(bet.answers) || bet.answers.length < 2) {
    return null;
  }

  const alternatives = bet.answers.filter(a => a.id !== bet.chosenAnswerId);
  if (!alternatives.length) return null;

  const next = alternatives[Math.floor(Math.random() * alternatives.length)];
  setChosenAnswerForBet(bet, next);
  saveState();
  return bet;
}

// Convenience: reroll for the currently active guessing round.
export function rerollCurrentSelectedAnswer() {
  const bet = getCurrentGuessingBet();
  if (!bet) return null;
  return rerollChosenAnswer(bet.id);
}


// ============================================================
// CREATING A ROUND
// ============================================================

// Build and insert a new bet (round) into state.
// Returns the new bet object, or null on validation failure.
export function finalizeCreateBet({ attraction, land, question, hotRound, hotRoundBonus }) {
  if (!state.players || state.players.length < 2) return null;
  if (!attraction || !land || !question) return null;

  const betId     = uid();
  const nextIndex = state.bets.length
    ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
    : 1;

  const bet = {
    id:                  betId,
    index:               nextIndex,
    description:         question,
    createdAt:           new Date().toLocaleString(),
    attraction,
    land,
    status:              'answering',  // answering → guessing → resolved
    answers:             [],
    chosenAnswerId:      null,
    correctAuthorId:     null,
    correctAuthors:      [],
    guesses:             [],
    roundWinners:        [],
    bonusAwards:         [],
    answerOrder:         shuffle(state.players.map(p => p.id)),
    wagerOrder:          [],
    ghostAnswerUsed:     false,
    hotRound:            !!hotRound,
    hotRoundBonus:       clampScore(hotRoundBonus || 0),
    resolvedAt:          null,
    scoreChanges:        [],
    // Idempotency guard: prevents applyRoundAdjustments from
    // re-awarding bonuses if the adjustments modal is opened twice.
    adjustmentsApplied:  false,
    cachedAdjustments:   null,
    // Cache for computeBonusPointsForRound (avoids O(n²) rescan).
    computedBonuses:     null
  };

  state.bets.unshift(bet);
  saveState();
  return bet;
}


// ============================================================
// ANSWER PHASE
// ============================================================

// Reset a round's answer state and mark it as 'answering'.
// Called when a new round is started.
export function startAnswerPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

  bet.answers          = [];
  bet.status           = 'answering';
  bet.ghostAnswerUsed  = false;
  bet.chosenAnswerId   = null;
  bet.correctAuthorId  = null;
  bet.correctAuthors   = [];

  if (!Array.isArray(bet.answerOrder) || !bet.answerOrder.length) {
    bet.answerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  return bet;
}

// Determine the next player who should provide an answer.
// Returns { done, bet, player, nextIndex }.
// When done is true, the round has transitioned to 'guessing'.
export function getNextAnswerPrompt(betId, currentAnswerIndex) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    return { done: true, bet: null, player: null, nextIndex: currentAnswerIndex };
  }

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  // All players have answered — transition to guessing phase.
  if (currentAnswerIndex >= order.length) {
    bet.status = 'guessing';

    if (!bet.chosenAnswerId && bet.answers.length) {
      chooseRandomAnswerForBet(bet);
    }

    bet.wagerOrder = shuffle(state.players.map(p => p.id));
    saveState();

    return { done: true, bet, player: null, nextIndex: currentAnswerIndex };
  }

  const playerId = order[currentAnswerIndex];
  const player   = state.players.find(p => p.id === playerId);

  // Player was removed mid-round — skip silently.
  if (!player) {
    return getNextAnswerPrompt(betId, currentAnswerIndex + 1);
  }

  return { done: false, bet, player, nextIndex: currentAnswerIndex };
}

// Record one player's answer and advance the index.
// Returns { bet, nextIndex }.
export function savePlayerAnswer(betId, currentAnswerIndex, text, useGhost = false) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return { bet: null, nextIndex: currentAnswerIndex };

  const order    = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  const playerId = order[currentAnswerIndex];
  const player   = state.players.find(p => p.id === playerId);
  if (!player) return { bet, nextIndex: currentAnswerIndex + 1 };

  bet.answers.push({
    id:       uid(),
    playerId: player.id,
    text:     text.trim(),
    isGhost:  !!useGhost
  });

  if (useGhost) bet.ghostAnswerUsed = true;

  saveState();
  return { bet, nextIndex: currentAnswerIndex + 1 };
}

// Explicitly initialize guessing phase for a bet.
// Usually called automatically by getNextAnswerPrompt when all
// players have answered, but available as a direct call if needed.
export function startGuessPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !bet.answers?.length) return null;

  if (!bet.chosenAnswerId) chooseRandomAnswerForBet(bet);

  if (!Array.isArray(bet.wagerOrder) || !bet.wagerOrder.length) {
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  return bet;
}


// ============================================================
// WAGER VALIDATION
// ============================================================

// Sanitize raw guesses from the DOM into normalized guess objects.
// Returns the normalized array, or null if validation fails.
// Returning null signals ui.js to show an error and abort.
export function normalizeGuesses(rawGuesses) {
  const guesses = rawGuesses.map(g => {
    let wager = Number(g.wager) || 0;
    if (!Number.isFinite(wager) || wager < 0) wager = 0;
    const available = getAvailablePoints(g.playerId);
    if (wager > available) wager = available; // silently cap
    return {
      playerId:        g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager
    };
  });

  // At least one player must be wagering to proceed.
  const active = guesses.filter(g => g.wager > 0);
  if (!active.length) return null; // ui.js shows the error

  // Double-check no one is over their limit after capping.
  for (const g of active) {
    const available = getAvailablePoints(g.playerId);
    if (g.wager > available) return null;
  }

  return guesses;
}

// Enforce table stakes: all players who are in must wager
// the same amount. Returns { ok, target?, message? }.
export function validateTableStakes(guesses) {
  const active        = guesses.filter(g => g.wager > 0);
  if (!active.length) return { ok: false, message: 'At least one player must wager points.' };

  const uniqueWagers  = Array.from(new Set(active.map(g => g.wager)));
  if (uniqueWagers.length === 1) return { ok: true, target: uniqueWagers[0] };

  return {
    ok: false,
    message: 'Table stakes: everyone who is in must wager the same amount before locking.'
  };
}


// ============================================================
// RESOLVE — PHASE 1: WAGERS ONLY
// Applies wager payouts and marks the round as 'resolved'.
// Does NOT apply Hot Round, bonuses, or catch-up — those are
// phase 2 (applyRoundAdjustments).
//
// Payout model:
//   - Authors never win or lose points from wagers.
//   - Losers (wrong guess, non-author) lose their wager.
//   - Winners (correct guess, non-author) share losers' pot
//     proportionally to their wager size.
//   - If no one guesses correctly, all losing wagers go to
//     the Hunny Pot instead.
//
// Returns a result object for ui.js to render, or null on error.
// ============================================================

export function resolveGuessingBet(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  if (!correctAuthors.length) return null; // no answer chosen

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  const wagers = (bet.guesses || []).map(g => ({
    playerId:        g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager:           Math.max(0, Number(g.wager || 0))
  }));

  // Authors are excluded from winning/losing on their own answer.
  const winners = wagers.filter(w =>
    w.wager > 0 &&
    !correctAuthors.includes(w.playerId) &&
    correctAuthors.includes(w.guessedAuthorId)
  );

  const losers = wagers.filter(w =>
    w.wager > 0 &&
    !correctAuthors.includes(w.playerId) &&
    !correctAuthors.includes(w.guessedAuthorId)
  );

  const anyCorrect       = winners.length > 0;
  const losersPot        = losers.reduce((sum, w) => sum + w.wager, 0);
  const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

  // Deduct losing wagers.
  losers.forEach(w => {
    const player = playerMap[w.playerId];
    if (player) player.currentPoints = clampScore(player.currentPoints - w.wager);
  });

  // Distribute losers' pot among winners proportionally.
  // FIX: use Math.round() explicitly before clampScore to ensure
  // floating-point remainders don't silently disappear.
  if (anyCorrect && losersPot > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share = Math.round((losersPot * w.wager) / totalWinnerWager);
      player.currentPoints = clampScore(player.currentPoints + share);
    });
  } else if (!anyCorrect && losersPot > 0) {
    // No winners — losing wagers go to the Hunny Pot.
    state.pot += losersPot;
  }

  // Mark as resolved AFTER wager payouts but BEFORE bonuses.
  bet.status      = 'resolved';
  bet.resolvedAt  = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  enforceMinPot();
  saveState();

  // Build result object for ui.js to render.
  const authorNames = correctAuthors
    .map(id => state.players.find(p => p.id === id)?.name)
    .filter(Boolean);

  const winnerLines = winners
    .map(w => {
      const p = state.players.find(pl => pl.id === w.playerId);
      return p ? `${p.name} (wagered ${w.wager})` : null;
    })
    .filter(Boolean);

  return {
    betId:            bet.id,
    description:      bet.description,
    attraction:       bet.attraction,
    land:             bet.land,
    createdAt:        bet.createdAt,
    resolvedAt:       bet.resolvedAt,
    authorNames,
    winners:          winnerLines,
    anyCorrect,
    losersPot,
    totalWinnerWager
  };
}


// ============================================================
// RESOLVE — PHASE 2: ADJUSTMENTS
// Applied after wager payouts when the player opens the
// "View adjustments" modal on the reveal screen.
//
// Applies in order:
//   1. Hot Round bonus (from Hunny Pot to winners)
//   2. Automatic bonuses (hidden author, streak, multi-land)
//   3. Catch-up (small pot transfer to last-place player)
//
// FIX: now idempotent. If adjustmentsApplied is true, returns
// the cached summary without re-applying anything. This means
// opening the adjustments modal twice after one round will
// never double-award bonuses.
//
// Returns an adjustments summary object for ui.js to render.
// ============================================================

export function applyRoundAdjustments(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return null;

  // IDEMPOTENCY GUARD — return cached result if already applied.
  if (bet.adjustmentsApplied) {
    return bet.cachedAdjustments || null;
  }

  const summary = {
    hotRoundLines: [],
    bonusLines:    [],
    catchUpLine:   null,
    potBefore:     state.pot,
    potAfter:      state.pot
  };

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  const wagers = (bet.guesses || []).map(g => ({
    playerId:        g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager:           Math.max(0, Number(g.wager || 0))
  }));

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  const winners = wagers.filter(w =>
    w.wager > 0 &&
    !correctAuthors.includes(w.playerId) &&
    correctAuthors.includes(w.guessedAuthorId)
  );

  const anyCorrect       = winners.length > 0;
  const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

  // Snapshot scores before any adjustments.
  const beforeScores = Object.fromEntries(
    state.players.map(p => [p.id, clampScore(p.currentPoints)])
  );

  // ---- 1. Hot Round payout ----
  if (bet.hotRound && bet.hotRoundBonus > 0 && anyCorrect && totalWinnerWager > 0 && state.pot > 0) {
    const extraTotal = Math.min(clampScore(bet.hotRoundBonus), clampScore(state.pot));
    if (extraTotal > 0) {
      winners.forEach(w => {
        const player = playerMap[w.playerId];
        if (!player) return;
        const share = clampScore(Math.round((extraTotal * w.wager) / totalWinnerWager));
        if (share <= 0) return;
        player.currentPoints = clampScore(player.currentPoints + share);
        summary.hotRoundLines.push(`${player.name}: +${share} Hot Round bonus`);
      });
      state.pot -= extraTotal;
    }
  }

  // ---- 2. Automatic bonuses ----
  // Use cached bonuses if available (set by a previous call that
  // was interrupted before adjustmentsApplied was set to true).
  // Otherwise compute and cache them now.
  if (!bet.computedBonuses) {
    bet.computedBonuses = computeBonusPointsForRound(betId);
  }
  const roundBonuses = bet.computedBonuses || [];
  bet.bonusAwards    = [];

  roundBonuses.forEach(bonus => {
    const player = playerMap[bonus.playerId];
    if (!player) return;
    player.currentPoints = clampScore(player.currentPoints + bonus.amount);
    summary.bonusLines.push(`${player.name}: +${bonus.amount} (${bonus.reason})`);
  });

  if (roundBonuses.length) {
    // Record in the awarded bonuses log for display.
    const records = roundBonuses.map(b => {
      const p = state.players.find(pl => pl.id === b.playerId);
      return {
        id:         uid(),
        bonusId:    'auto',
        bonusName:  'Automatic bonus',
        points:     b.amount,
        playerId:   b.playerId,
        playerName: p ? p.name : 'Unknown',
        roundId:    bet.id,
        reason:     b.reason
      };
    });

    bet.bonusAwards = roundBonuses.map(b => ({
      playerId: b.playerId,
      amount:   b.amount,
      reason:   b.reason
    }));

    state.awardedBonuses.unshift(...records);
  }

  // ---- 3. Catch-up mechanic ----
  // If the gap between leader and last place is >= 10, transfer
  // a small number of pot points to last place — but never enough
  // to let them pass the second-to-last player or the leader.
  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);

  if (state.pot > 0 && ranked.length >= 2) {
    const leader = ranked[0];
    const last   = ranked[ranked.length - 1];
    const gap    = leader.currentPoints - last.currentPoints;

    if (gap >= 10) {
      const secondLast = ranked[ranked.length - 2];

      // Never let catch-up push last place past second-to-last.
      const maxToSecondLast = secondLast
        ? Math.max(0, secondLast.currentPoints - last.currentPoints)
        : gap;

      // Never let catch-up push last place to equal the leader.
      const maxToLeaderMinusOne = Math.max(
        0,
        leader.currentPoints - 1 - last.currentPoints
      );

      const hardCap = Math.min(
        5,                    // max 5 points at once
        state.pot,            // limited by pot balance
        maxToSecondLast,
        maxToLeaderMinusOne
      );

      if (hardCap > 0) {
        last.currentPoints = clampScore(last.currentPoints + hardCap);
        state.pot         -= hardCap;
        summary.catchUpLine =
          `Gave ${hardCap} points from the Hunny Pot to ${last.name} ` +
          `to help them catch up without passing anyone.`;
      }
    }
  }

  enforceMinPot();

  // Record per-player score deltas on the bet for history display.
  bet.scoreChanges = state.players.map(p => {
    const before = beforeScores[p.id] ?? 0;
    const after  = clampScore(p.currentPoints);
    return { playerId: p.id, before, after, delta: after - before };
  });

  summary.potAfter = state.pot;

  // Mark as applied and cache the summary so re-opening the modal
  // returns the same result without re-running any of the above.
  bet.adjustmentsApplied = true;
  bet.cachedAdjustments  = summary;

  saveState();
  return summary;
}


// ============================================================
// MANUAL BONUS AWARD
// Called from the bonus library on the history screen when a
// host manually awards a bonus to a player.
// ============================================================

export function awardBonus(bonusId, playerId) {
  const bonus  = state.bonuses.find(b => b.id === bonusId);
  const player = state.players.find(p => p.id === playerId);
  if (!bonus || !player) return;

  player.currentPoints = clampScore(player.currentPoints + bonus.points);

  const latest = state.bets.find(b => b.status === 'resolved');
  state.awardedBonuses.unshift({
    id:         uid(),
    bonusId:    bonus.id,
    bonusName:  bonus.name,
    points:     bonus.points,
    playerId:   player.id,
    playerName: player.name,
    roundId:    latest?.id || null,
    reason:     bonus.name
  });

  saveState();
  return `+${bonus.points} to ${player.name} for "${bonus.name}".`;
}
