// ============================================================
// game-logic-rounds.js
// Who Said Diz — player management, Hunny Pot, round lifecycle,
// wagering, and round resolution.
//
// DEBUG LOGGING: console.log statements are added throughout
// to surface state at each critical step via the in-page console.
// Remove all console.log calls before production release.
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

export function addPlayer(name, startingPoints) {
  console.log('addPlayer:', name, startingPoints);
  state.players.push({
    id:             uid(),
    name:           name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints:  clampScore(startingPoints)
  });
  enforceMinPot();
  saveState();
  console.log('addPlayer done, players now:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));
}

export function removePlayer(playerId) {
  console.log('removePlayer:', playerId);
  state.players = state.players.filter(p => p.id !== playerId);

  state.bets.forEach(bet => {
    if (bet.status === 'resolved') return;
    if (bet.guesses)     bet.guesses     = bet.guesses.filter(g => g.playerId !== playerId);
    if (bet.answerOrder) bet.answerOrder = bet.answerOrder.filter(id => id !== playerId);
    if (bet.wagerOrder)  bet.wagerOrder  = bet.wagerOrder.filter(id => id !== playerId);
    if (bet.answers)     bet.answers     = bet.answers.filter(a => a.playerId !== playerId);
  });

  state.bets = state.bets.filter(bet => {
    if (bet.status === 'resolved') return true;
    const remaining = (bet.answerOrder || []).filter(id =>
      state.players.some(p => p.id === id)
    );
    return remaining.length >= 2;
  });

  enforceMinPot();
  saveState();
  console.log('removePlayer done, players remaining:', state.players.map(p => p.name).join(', '));
}

export function resetGameKeepingPlayers() {
  console.log('resetGameKeepingPlayers');
  state.players.forEach(p => {
    p.currentPoints = clampScore(p.startingPoints || 0);
  });
  state.bets          = [];
  state.pot           = 0;
  state.awardedBonuses = [];
  enforceMinPot();
  saveState();
  console.log('resetGameKeepingPlayers done, player scores reset to starting points');
}


// ============================================================
// HUNNY POT
// ============================================================

export function giveFromPot(playerId, amount) {
  console.log('giveFromPot playerId:', playerId, 'amount:', amount);
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 'Player not found.';
  if (state.pot <= 0) return 'No points in the Hunny Pot right now.';

  let amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a number greater than 0.';
  if (amt > state.pot) amt = state.pot;

  state.pot            -= amt;
  player.currentPoints  = clampScore(player.currentPoints + amt);
  enforceMinPot();
  saveState();
  console.log('giveFromPot done:', player.name, 'now has', player.currentPoints, 'pot now', state.pot);
  return null;
}

export function addToPot(amount) {
  console.log('addToPot amount:', amount);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a number greater than 0.';
  state.pot += amt;
  enforceMinPot();
  saveState();
  console.log('addToPot done, pot now:', state.pot);
  return null;
}

export function clearPot() {
  console.log('clearPot, pot was:', state.pot);
  if (!state.pot) return;
  state.pot = 0;
  enforceMinPot();
  saveState();
  console.log('clearPot done, pot now:', state.pot);
}


// ============================================================
// ROUND HELPERS
// ============================================================

export function getCurrentGuessingBet() {
  const bet = state.bets.find(b => b.status === 'guessing') || null;
  console.log('getCurrentGuessingBet:', bet ? bet.id : 'none');
  return bet;
}

export function setChosenAnswerForBet(bet, chosen) {
  if (!bet || !chosen) return;
  bet.chosenAnswerId = chosen.id;
  const sameTextAuthors = bet.answers
    .filter(a => a.text === chosen.text)
    .map(a => a.playerId);
  bet.correctAuthors  = sameTextAuthors;
  bet.correctAuthorId = sameTextAuthors[0] || null;
  console.log('setChosenAnswerForBet: chosen answer:', chosen.text, 'correctAuthors:', bet.correctAuthors);
}

export function chooseRandomAnswerForBet(bet) {
  if (!bet || !Array.isArray(bet.answers) || !bet.answers.length) return;
  const idx = Math.floor(Math.random() * bet.answers.length);
  setChosenAnswerForBet(bet, bet.answers[idx]);
  console.log('chooseRandomAnswerForBet: picked index', idx, 'answer:', bet.answers[idx].text);
}

export function rerollChosenAnswer(betId) {
  console.log('rerollChosenAnswer betId:', betId);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !Array.isArray(bet.answers) || bet.answers.length < 2) {
    console.log('rerollChosenAnswer: not enough answers to reroll');
    return null;
  }
  const alternatives = bet.answers.filter(a => a.id !== bet.chosenAnswerId);
  if (!alternatives.length) return null;
  const next = alternatives[Math.floor(Math.random() * alternatives.length)];
  setChosenAnswerForBet(bet, next);
  saveState();
  console.log('rerollChosenAnswer done: new answer:', next.text);
  return bet;
}

export function rerollCurrentSelectedAnswer() {
  const bet = getCurrentGuessingBet();
  if (!bet) return null;
  return rerollChosenAnswer(bet.id);
}


// ============================================================
// CREATING A ROUND
// ============================================================

export function finalizeCreateBet({ attraction, land, question, hotRound, hotRoundBonus }) {
  console.log('finalizeCreateBet:', { attraction, land, question, hotRound, hotRoundBonus });
  if (!state.players || state.players.length < 2) {
    console.log('finalizeCreateBet: not enough players');
    return null;
  }
  if (!attraction || !land || !question) {
    console.log('finalizeCreateBet: missing required fields');
    return null;
  }

  const betId     = uid();
  const nextIndex = state.bets.length
    ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
    : 1;

  const bet = {
    id:                 betId,
    index:              nextIndex,
    description:        question,
    createdAt:          new Date().toLocaleString(),
    attraction,
    land,
    status:             'answering',
    answers:            [],
    chosenAnswerId:     null,
    correctAuthorId:    null,
    correctAuthors:     [],
    guesses:            [],
    roundWinners:       [],
    bonusAwards:        [],
    answerOrder:        shuffle(state.players.map(p => p.id)),
    wagerOrder:         [],
    ghostAnswerUsed:    false,
    hotRound:           !!hotRound,
    hotRoundBonus:      clampScore(hotRoundBonus || 0),
    resolvedAt:         null,
    scoreChanges:       [],
    adjustmentsApplied: false,
    cachedAdjustments:  null,
    computedBonuses:    null
  };

  state.bets.unshift(bet);
  saveState();
  console.log('finalizeCreateBet done, bet id:', betId, 'answerOrder:', bet.answerOrder);
  return bet;
}


// ============================================================
// ANSWER PHASE
// ============================================================

export function startAnswerPhase(betId) {
  console.log('startAnswerPhase betId:', betId);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    console.log('startAnswerPhase: bet not found');
    return null;
  }

  bet.answers         = [];
  bet.status          = 'answering';
  bet.ghostAnswerUsed = false;
  bet.chosenAnswerId  = null;
  bet.correctAuthorId = null;
  bet.correctAuthors  = [];

  if (!Array.isArray(bet.answerOrder) || !bet.answerOrder.length) {
    bet.answerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  console.log('startAnswerPhase done, answerOrder:', bet.answerOrder);
  return bet;
}

export function getNextAnswerPrompt(betId, currentAnswerIndex) {
  console.log('getNextAnswerPrompt betId:', betId, 'index:', currentAnswerIndex);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    console.log('getNextAnswerPrompt: bet not found');
    return { done: true, bet: null, player: null, nextIndex: currentAnswerIndex };
  }

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  if (currentAnswerIndex >= order.length) {
    console.log('getNextAnswerPrompt: all players answered, transitioning to guessing');
    bet.status = 'guessing';
    if (!bet.chosenAnswerId && bet.answers.length) chooseRandomAnswerForBet(bet);
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
    saveState();
    return { done: true, bet, player: null, nextIndex: currentAnswerIndex };
  }

  const playerId = order[currentAnswerIndex];
  const player   = state.players.find(p => p.id === playerId);

  if (!player) {
    console.log('getNextAnswerPrompt: player not found, skipping index', currentAnswerIndex);
    return getNextAnswerPrompt(betId, currentAnswerIndex + 1);
  }

  console.log('getNextAnswerPrompt: next player is', player.name);
  return { done: false, bet, player, nextIndex: currentAnswerIndex };
}

export function savePlayerAnswer(betId, currentAnswerIndex, text, useGhost = false) {
  console.log('savePlayerAnswer betId:', betId, 'index:', currentAnswerIndex, 'text:', text, 'ghost:', useGhost);
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
  console.log('savePlayerAnswer done, answers so far:', bet.answers.length);
  return { bet, nextIndex: currentAnswerIndex + 1 };
}

export function startGuessPhase(betId) {
  console.log('startGuessPhase betId:', betId);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !bet.answers?.length) {
    console.log('startGuessPhase: bet not found or no answers');
    return null;
  }
  if (!bet.chosenAnswerId) chooseRandomAnswerForBet(bet);
  if (!Array.isArray(bet.wagerOrder) || !bet.wagerOrder.length) {
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
  }
  saveState();
  console.log('startGuessPhase done, chosenAnswerId:', bet.chosenAnswerId);
  return bet;
}


// ============================================================
// WAGER VALIDATION
// ============================================================

export function normalizeGuesses(rawGuesses) {
  console.log('normalizeGuesses rawGuesses:', rawGuesses);
  const guesses = rawGuesses.map(g => {
    let wager     = Number(g.wager) || 0;
    if (!Number.isFinite(wager) || wager < 0) wager = 0;
    const available = getAvailablePoints(g.playerId);
    if (wager > available) wager = available;
    return {
      playerId:        g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager
    };
  });

  const active = guesses.filter(g => g.wager > 0);
  if (!active.length) {
    console.log('normalizeGuesses: no active wagers');
    return null;
  }

  for (const g of active) {
    const available = getAvailablePoints(g.playerId);
    if (g.wager > available) {
      console.log('normalizeGuesses: wager exceeds available for', g.playerId);
      return null;
    }
  }

  console.log('normalizeGuesses done:', guesses);
  return guesses;
}

export function validateTableStakes(guesses) {
  const active       = guesses.filter(g => g.wager > 0);
  if (!active.length) return { ok: false, message: 'At least one player must wager points.' };
  const uniqueWagers = Array.from(new Set(active.map(g => g.wager)));
  console.log('validateTableStakes active wagers:', active.map(g => g.wager), 'unique:', uniqueWagers);
  if (uniqueWagers.length === 1) return { ok: true, target: uniqueWagers[0] };
  return {
    ok: false,
    message: 'Table stakes: everyone who is in must wager the same amount before locking.'
  };
}


// ============================================================
// RESOLVE — PHASE 1: WAGERS ONLY
// ============================================================

export function resolveGuessingBet(betId) {
  console.log('--- resolveGuessingBet START ---');
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    console.log('resolveGuessingBet: bet not found');
    return null;
  }

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  if (!correctAuthors.length) {
    console.log('resolveGuessingBet: no correct authors found');
    return null;
  }

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  const wagers = (bet.guesses || []).map(g => ({
    playerId:        g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager:           Math.max(0, Number(g.wager || 0))
  }));

  console.log('correctAuthors:', correctAuthors);
  console.log('wagers:', wagers);
  console.log('player scores BEFORE:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));

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

  console.log('winners:', winners.map(w => {
    const p = state.players.find(pl => pl.id === w.playerId);
    return (p ? p.name : w.playerId) + ' wager:' + w.wager;
  }));
  console.log('losers:', losers.map(w => {
    const p = state.players.find(pl => pl.id === w.playerId);
    return (p ? p.name : w.playerId) + ' wager:' + w.wager;
  }));
  console.log('anyCorrect:', anyCorrect, 'losersPot:', losersPot, 'totalWinnerWager:', totalWinnerWager);

  // Deduct losing wagers.
  losers.forEach(w => {
    const player = playerMap[w.playerId];
    if (player) {
      const before = player.currentPoints;
      player.currentPoints = clampScore(player.currentPoints - w.wager);
      console.log('LOSER:', player.name, 'before:', before, 'wager:', w.wager, 'after:', player.currentPoints);
    }
  });

  // Pay out winners.
  if (anyCorrect && losersPot > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share  = Math.round((losersPot * w.wager) / totalWinnerWager);
      const before = player.currentPoints;
      player.currentPoints = clampScore(player.currentPoints + share);
      console.log('WINNER:', player.name, 'before:', before, 'share:', share, 'after:', player.currentPoints);
    });
  } else if (!anyCorrect && losersPot > 0) {
    const beforePot = state.pot;
    state.pot += losersPot;
    console.log('No winners — losersPot', losersPot, 'added to Hunny Pot:', beforePot, '->', state.pot);
  } else {
    console.log('No payout branch hit — anyCorrect:', anyCorrect, 'losersPot:', losersPot);
  }

  bet.status       = 'resolved';
  bet.resolvedAt   = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  enforceMinPot();
  saveState();

  console.log('player scores AFTER:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));
  console.log('pot AFTER:', state.pot);
  console.log('--- resolveGuessingBet END ---');

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
// ============================================================

export function applyRoundAdjustments(betId) {
  console.log('--- applyRoundAdjustments START ---');
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') {
    console.log('applyRoundAdjustments: bet not found or not resolved');
    return null;
  }

  if (bet.adjustmentsApplied) {
    console.log('applyRoundAdjustments: already applied, returning cached summary');
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

  const beforeScores = Object.fromEntries(
    state.players.map(p => [p.id, clampScore(p.currentPoints)])
  );

  console.log('applyRoundAdjustments scores BEFORE adjustments:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));

  // ---- 1. Hot Round payout ----
  if (bet.hotRound && bet.hotRoundBonus > 0 && anyCorrect && totalWinnerWager > 0 && state.pot > 0) {
    const extraTotal = Math.min(clampScore(bet.hotRoundBonus), clampScore(state.pot));
    console.log('Hot Round payout, extraTotal:', extraTotal);
    if (extraTotal > 0) {
      winners.forEach(w => {
        const player = playerMap[w.playerId];
        if (!player) return;
        const share = clampScore(Math.round((extraTotal * w.wager) / totalWinnerWager));
        if (share <= 0) return;
        const before = player.currentPoints;
        player.currentPoints = clampScore(player.currentPoints + share);
        summary.hotRoundLines.push(`${player.name}: +${share} Hot Round bonus`);
        console.log('Hot Round:', player.name, 'before:', before, 'share:', share, 'after:', player.currentPoints);
      });
      state.pot -= extraTotal;
    }
  } else {
    console.log('Hot Round skipped — hotRound:', bet.hotRound, 'bonus:', bet.hotRoundBonus, 'anyCorrect:', anyCorrect, 'pot:', state.pot);
  }

  // ---- 2. Automatic bonuses ----
  if (!bet.computedBonuses) {
    bet.computedBonuses = computeBonusPointsForRound(betId);
  }
  const roundBonuses = bet.computedBonuses || [];
  console.log('Auto bonuses computed:', roundBonuses);

  bet.bonusAwards = [];
  roundBonuses.forEach(bonus => {
    const player = playerMap[bonus.playerId];
    if (!player) return;
    const before = player.currentPoints;
    player.currentPoints = clampScore(player.currentPoints + bonus.amount);
    summary.bonusLines.push(`${player.name}: +${bonus.amount} (${bonus.reason})`);
    console.log('Bonus:', player.name, 'reason:', bonus.reason, 'before:', before, 'after:', player.currentPoints);
  });

  if (roundBonuses.length) {
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
  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  console.log('Catch-up check, ranked:', ranked.map(p => p.name + ':' + p.currentPoints).join(', '));

  if (state.pot > 0 && ranked.length >= 2) {
    const leader = ranked[0];
    const last   = ranked[ranked.length - 1];
    const gap    = leader.currentPoints - last.currentPoints;
    console.log('Gap between leader and last:', gap, '(needs >= 10 to trigger catch-up)');

    if (gap >= 10) {
      const secondLast        = ranked[ranked.length - 2];
      const maxToSecondLast   = secondLast
        ? Math.max(0, secondLast.currentPoints - last.currentPoints)
        : gap;
      const maxToLeaderMinusOne = Math.max(0, leader.currentPoints - 1 - last.currentPoints);
      const hardCap = Math.min(5, state.pot, maxToSecondLast, maxToLeaderMinusOne);

      console.log('Catch-up triggered: leader', leader.name, leader.currentPoints, 'last', last.name, last.currentPoints, 'gap', gap, 'hardCap', hardCap);

      if (hardCap > 0) {
        const before = last.currentPoints;
        last.currentPoints  = clampScore(last.currentPoints + hardCap);
        state.pot          -= hardCap;
        summary.catchUpLine =
          `Gave ${hardCap} points from the Hunny Pot to ${last.name} to help them catch up.`;
        console.log('Catch-up applied:', last.name, 'before:', before, 'after:', last.currentPoints, 'pot now:', state.pot);
      }
    }
  }

  enforceMinPot();

  bet.scoreChanges = state.players.map(p => {
    const before = beforeScores[p.id] ?? 0;
    const after  = clampScore(p.currentPoints);
    return { playerId: p.id, before, after, delta: after - before };
  });

  summary.potAfter       = state.pot;
  bet.adjustmentsApplied = true;
  bet.cachedAdjustments  = summary;

  saveState();

  console.log('applyRoundAdjustments scores AFTER:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));
  console.log('pot AFTER adjustments:', state.pot);
  console.log('scoreChanges:', bet.scoreChanges);
  console.log('--- applyRoundAdjustments END ---');

  return summary;
}


// ============================================================
// MANUAL BONUS AWARD
// ============================================================

export function awardBonus(bonusId, playerId) {
  console.log('awardBonus bonusId:', bonusId, 'playerId:', playerId);
  const bonus  = state.bonuses.find(b => b.id === bonusId);
  const player = state.players.find(p => p.id === playerId);
  if (!bonus || !player) {
    console.log('awardBonus: bonus or player not found');
    return;
  }

  const before = player.currentPoints;
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
  console.log('awardBonus done:', player.name, 'before:', before, 'after:', player.currentPoints);
  return `+${bonus.points} to ${player.name} for "${bonus.name}".`;
}
