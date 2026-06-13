// ============================================================
// game-logic-rounds.js
// Who Said Diz — player management, Hunny Pot, round lifecycle,
// wagering, and round resolution.
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
// QUICK OPTION HELPERS
// ============================================================

function opt(key) {
  return !!state.gameOptions?.[key];
}


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
}

export function resetGameKeepingPlayers() {
  console.log('resetGameKeepingPlayers');
  state.players.forEach(p => {
    p.currentPoints = clampScore(p.startingPoints || 0);
  });
  state.bets           = [];
  state.pot            = 0;
  state.awardedBonuses = [];
  enforceMinPot();
  saveState();
}


// ============================================================
// GAME MODE / OPTIONS
// ============================================================

export function setGameMode(mode, optionsFromUI = null) {
  const valid = ['simple', 'competitive', 'custom'];
  state.gameMode = valid.includes(mode) ? mode : 'competitive';

  if (optionsFromUI && typeof optionsFromUI === 'object') {
    state.gameOptions = {
      ...state.gameOptions,
      ...optionsFromUI
    };
  }

  state.gameOptions.authorsWager = false;
  saveState();
}

export function updateGameOptions(patch) {
  state.gameOptions = {
    ...state.gameOptions,
    ...patch,
    authorsWager: false
  };
  saveState();
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
  return null;
}

export function addToPot(amount) {
  console.log('addToPot amount:', amount);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a number greater than 0.';
  state.pot += amt;
  enforceMinPot();
  saveState();
  return null;
}

export function clearPot() {
  console.log('clearPot, pot was:', state.pot);
  if (!state.pot) return;
  state.pot = 0;
  enforceMinPot();
  saveState();
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
}

export function chooseRandomAnswerForBet(bet) {
  if (!bet || !Array.isArray(bet.answers) || !bet.answers.length) return;
  const idx = Math.floor(Math.random() * bet.answers.length);
  setChosenAnswerForBet(bet, bet.answers[idx]);
}

export function rerollChosenAnswer(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !Array.isArray(bet.answers) || bet.answers.length < 2) return null;
  const alternatives = bet.answers.filter(a => a.id !== bet.chosenAnswerId);
  if (!alternatives.length) return null;
  const next = alternatives[Math.floor(Math.random() * alternatives.length)];
  setChosenAnswerForBet(bet, next);
  saveState();
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
  if (!state.players || state.players.length < 2) return null;
  if (!attraction || !land || !question) return null;

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
  return bet;
}


// ============================================================
// ANSWER PHASE
// ============================================================

export function startAnswerPhase(betId) {
  console.log('startAnswerPhase betId:', betId);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

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
  return bet;
}

export function getNextAnswerPrompt(betId, currentAnswerIndex) {
  console.log('getNextAnswerPrompt betId:', betId, 'index:', currentAnswerIndex);
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return { done: true, bet: null, player: null, nextIndex: currentAnswerIndex };

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

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
  if (!player) {
    return getNextAnswerPrompt(betId, currentAnswerIndex + 1);
  }

  return { done: false, bet, player, nextIndex: currentAnswerIndex };
}

export function savePlayerAnswer(betId, currentAnswerIndex, text, useGhost = false) {
  console.log('savePlayerAnswer betId:', betId, 'index:', currentAnswerIndex, 'ghost:', useGhost);
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

export function startGuessPhase(betId) {
  console.log('startGuessPhase betId:', betId);
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

  return guesses;
}

export function validateTableStakes(guesses) {
  const active = guesses.filter(g => g.wager > 0);
  if (!active.length) {
    return { ok: false, message: 'At least one player must wager points.' };
  }

  if (!opt('tableStakes')) {
    return { ok: true, target: null };
  }

  const uniqueWagers = Array.from(new Set(active.map(g => g.wager)));
  console.log('validateTableStakes active wagers:', active.map(g => g.wager), 'unique:', uniqueWagers);

  if (uniqueWagers.length === 1) {
    return { ok: true, target: uniqueWagers[0] };
  }

  return {
    ok: false,
    message: 'Table stakes: everyone who is in must wager the same amount before locking.'
  };
}


// ============================================================
// RESOLVE — PHASE 1: WAGERS
// ============================================================

export function resolveGuessingBet(betId) {
  console.log('--- resolveGuessingBet START ---');
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  if (!correctAuthors.length) return null;

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  const wagers = (bet.guesses || [])
    .map(g => ({
      playerId:        g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager:           Math.max(0, Number(g.wager || 0))
    }))
    .filter(w => !correctAuthors.includes(w.playerId));

  console.log('correctAuthors:', correctAuthors);
  console.log('wagers (authors filtered out):', wagers);
  console.log('player scores BEFORE:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));

  const winners = wagers.filter(w =>
    w.wager > 0 &&
    correctAuthors.includes(w.guessedAuthorId)
  );

  const losers = wagers.filter(w =>
    w.wager > 0 &&
    !correctAuthors.includes(w.guessedAuthorId)
  );

  const anyCorrect       = winners.length > 0;
  const losersPot        = losers.reduce((sum, w) => sum + w.wager, 0);
  const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

  losers.forEach(w => {
    const player = playerMap[w.playerId];
    if (player) {
      player.currentPoints = clampScore(player.currentPoints - w.wager);
    }
  });

  if (anyCorrect && losersPot > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share  = Math.round((losersPot * w.wager) / totalWinnerWager);
      player.currentPoints = clampScore(player.currentPoints + share);
    });
  } else if (!anyCorrect && losersPot > 0) {
    state.pot += losersPot;
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

  const chosenAnswer     = bet.answers?.find(a => a.id === bet.chosenAnswerId) || null;
  const chosenAnswerText = chosenAnswer ? chosenAnswer.text : '';

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
    totalWinnerWager,
    chosenAnswerText
  };
}


// ============================================================
// RESOLVE — PHASE 2: ADJUSTMENTS
// ============================================================

export function applyRoundAdjustments(betId) {
  console.log('--- applyRoundAdjustments START ---');
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return null;

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

  const beforeScores = Object.fromEntries(
    state.players.map(p => [p.id, clampScore(p.currentPoints)])
  );

  // 1. Hot Round
  if (opt('hotRounds') && bet.hotRound && bet.hotRoundBonus > 0 &&
      anyCorrect && totalWinnerWager > 0 && state.pot > 0) {
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

  // 2. Auto bonuses
  if (opt('autoBonuses')) {
    if (!bet.computedBonuses) {
      bet.computedBonuses = computeBonusPointsForRound(betId);
    }
    const roundBonuses = bet.computedBonuses || [];
    bet.bonusAwards = [];

    roundBonuses.forEach(bonus => {
      const player = playerMap[bonus.playerId];
      if (!player) return;
      player.currentPoints = clampScore(player.currentPoints + bonus.amount);
      summary.bonusLines.push(`${player.name}: +${bonus.amount} (${bonus.reason})`);
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
  }

  // 3. Catch-up
  if (opt('catchUp') && state.pot > 0 && state.players.length >= 2) {
    const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
    const leader = ranked[0];
    const last   = ranked[ranked.length - 1];
    const gap    = leader.currentPoints - last.currentPoints;

    if (gap >= 10) {
      const secondLast          = ranked[ranked.length - 2];
      const maxToSecondLast     = secondLast
        ? Math.max(0, secondLast.currentPoints - last.currentPoints)
        : gap;
      const maxToLeaderMinusOne = Math.max(0, leader.currentPoints - 1 - last.currentPoints);
      const hardCap = Math.min(5, state.pot, maxToSecondLast, maxToLeaderMinusOne);

      if (hardCap > 0) {
        last.currentPoints  = clampScore(last.currentPoints + hardCap);
        state.pot          -= hardCap;
        summary.catchUpLine =
          `Gave ${hardCap} points from the Hunny Pot to ${last.name} to help them catch up.`;
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
