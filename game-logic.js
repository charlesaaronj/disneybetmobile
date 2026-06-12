// game-logic.js
// Core game rules and transitions.
// This file owns how points move, how rounds advance, and how
// bonuses are computed. It *does not* directly touch the DOM,
// so it can be used from any UI layer.

import {
  state,
  uid,
  clampScore,
  shuffle,
  saveState,
  enforceMinPot,
  getAvailablePoints,
  escapeHtml,
  alertLike
} from './game-state.js';

// ---------- Players ----------

// Add a player with a starting balance.
export function addPlayer(name, startingPoints) {
  state.players.push({
    id: uid(),
    name: name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints: clampScore(startingPoints)
  });
  enforceMinPot();
  saveState();
}

// Remove a player and purge any guesses they participated in.
export function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  state.bets = state.bets.filter(
    bet => !bet.guesses?.some(g => g.playerId === playerId)
  );
  enforceMinPot();
  saveState();
}

// reset game scores
export function resetGameKeepingPlayers() {
  // Reset scores back to starting points.
  state.players.forEach(p => {
    p.currentPoints = clampScore(p.startingPoints || 0);
  });

  // Clear rounds, pot, and awarded bonuses.
  state.bets = [];
  state.pot = 0;
  state.awardedBonuses = [];

  enforceMinPot();
  saveState();
}

// ---------- Hunny Pot ----------

// Give some amount from the pot to a specific player.
export function giveFromPot(playerId, amount) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  if (state.pot <= 0) {
    alertLike('No points in the Hunny Pot right now.');
    return;
  }

  let amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    alertLike('Enter a number greater than 0.');
    return;
  }
  if (amt > state.pot) amt = state.pot;

  state.pot -= amt;
  enforceMinPot();
  player.currentPoints = clampScore(player.currentPoints + amt);
  saveState();
}

// Add arbitrary points into the Hunny Pot.
export function addToPot(amount) {
  let amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    alertLike('Enter a number greater than 0.');
    return;
  }
  state.pot += amt;
  enforceMinPot();
  saveState();
}

// Reset the pot to zero (subject to min pot rule).
export function clearPot() {
  if (!state.pot) return;
  state.pot = 0;
  enforceMinPot();
  saveState();
}

// ---------- Betting / round helpers ----------

// Return the active bet that is currently in "guessing" phase.
export function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

// Given a bet and a chosen answer object, mark that answer as canonical.
export function setChosenAnswerForBet(bet, chosen) {
  if (!bet || !chosen) return;

  bet.chosenAnswerId = chosen.id;

  // If multiple authors gave identical text, treat all as "correct".
  const sameTextAuthors = bet.answers
    .filter(a => a.text === chosen.text)
    .map(a => a.playerId);

  bet.correctAuthors = sameTextAuthors;
  bet.correctAuthorId = sameTextAuthors[0] || null;
}

// Select a random answer for the bet if one hasn't been chosen.
export function chooseRandomAnswerForBet(bet) {
  if (!bet || !Array.isArray(bet.answers) || !bet.answers.length) return;
  const idx = Math.floor(Math.random() * bet.answers.length);
  const chosen = bet.answers[idx];
  setChosenAnswerForBet(bet, chosen);
}

// Reroll the selected answer for a given bet (if multiple answers exist).
export function rerollChosenAnswer(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !Array.isArray(bet.answers) || bet.answers.length < 2) {
    alertLike('There is not another answer available to choose.');
    return null;
  }

  const currentId = bet.chosenAnswerId;
  const alternatives = bet.answers.filter(a => a.id !== currentId);
  if (!alternatives.length) {
    alertLike('There is not another answer available to choose.');
    return null;
  }

  const next = alternatives[Math.floor(Math.random() * alternatives.length)];
  setChosenAnswerForBet(bet, next);
  saveState();

  // Return the bet so UI can re-render.
  return bet;
}

// Convenience: reroll for the actively guessing round.
export function rerollCurrentSelectedAnswer() {
  const bet = getCurrentGuessingBet();
  if (!bet) {
    alertLike('No round is ready right now.');
    return null;
  }
  return rerollChosenAnswer(bet.id);
}

// ---------- Creating a round ----------

// Build and insert a new bet into state using provided options.
export function finalizeCreateBet({ attraction, land, question, hotRound, hotRoundBonus }) {
  if (!state.players || state.players.length < 2) {
    alertLike('You need at least two family members to play.');
    return null;
  }

  if (!attraction || !land || !question) {
    alertLike('Attraction, Land, and Question are all required.');
    return null;
  }

  const betId = uid();

  // Keep an internal index so we can display rounds in a natural order.
  const nextIndex = state.bets.length
    ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
    : 1;

  const bet = {
    id: betId,
    index: nextIndex,
    description: question,
    createdAt: new Date().toLocaleString(),
    attraction,
    land,
    status: 'answering',     // answering -> guessing -> resolved
    answers: [],
    chosenAnswerId: null,
    correctAuthorId: null,
    correctAuthors: [],
    guesses: [],
    roundWinners: [],
    bonusAwards: [],
    answerOrder: shuffle(state.players.map(p => p.id)),
    wagerOrder: [],
    ghostAnswerUsed: false,
    hotRound: !!hotRound,
    hotRoundBonus: clampScore(hotRoundBonus || 0)
  };

  state.bets.unshift(bet);
  saveState();
  return bet;
}

// Reset answer collection metadata for a bet and prepare it for answering.
export function startAnswerPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

  bet.answers = [];
  bet.status = 'answering';
  bet.ghostAnswerUsed = false;
  bet.chosenAnswerId = null;
  bet.correctAuthorId = null;
  bet.correctAuthors = [];

  if (!Array.isArray(bet.answerOrder) || !bet.answerOrder.length) {
    bet.answerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  return bet;
}

// Determine the next player who should provide an answer, or transition
// the bet into "guessing" state if all have answered.
export function getNextAnswerPrompt(betId, currentAnswerIndex) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    return { done: true, bet: null, player: null, nextIndex: currentAnswerIndex };
  }

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  // All players have answered -> move to guessing phase.
  if (currentAnswerIndex >= order.length) {
    bet.status = 'guessing';

    // Ensure there is a chosen answer for guessing.
    if (!bet.chosenAnswerId && bet.answers.length) {
      chooseRandomAnswerForBet(bet);
    }

    // Randomize guessing / wagering order.
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
    saveState();

    return { done: true, bet, player: null, nextIndex: currentAnswerIndex };
  }

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);

  // If a player somehow doesn't exist, skip and recurse.
  if (!player) {
    return getNextAnswerPrompt(betId, currentAnswerIndex + 1);
  }

  return {
    done: false,
    bet,
    player,
    nextIndex: currentAnswerIndex
  };
}

// Push a typed-in answer for the current player in the answer sequence.
export function savePlayerAnswer(betId, currentAnswerIndex, text, useGhost = false) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return { bet: null, nextIndex: currentAnswerIndex };

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return { bet, nextIndex: currentAnswerIndex + 1 };
  }

  // Ghost answers are generated externally; we just mark that it was used.
  bet.answers.push({
    id: uid(),
    playerId: player.id,
    text: text.trim(),
    isGhost: !!useGhost
  });

  if (useGhost) {
    bet.ghostAnswerUsed = true;
  }

  saveState();
  return { bet, nextIndex: currentAnswerIndex + 1 };
}

// Initialize the guessing phase for a bet.
export function startGuessPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;
  if (!bet.answers || !bet.answers.length) return null;

  if (!bet.chosenAnswerId) {
    chooseRandomAnswerForBet(bet);
  }

  if (!Array.isArray(bet.wagerOrder) || !bet.wagerOrder.length) {
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  return bet;
}

// Validate and normalize guesses constructed by the UI layer.
export function normalizeGuesses(rawGuesses) {
  const guesses = rawGuesses.map(g => {
    let wager = Number(g.wager) || 0;
    if (!Number.isFinite(wager) || wager < 0) wager = 0;
    const available = getAvailablePoints(g.playerId);
    if (wager > available) wager = available;
    return {
      playerId: g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager
    };
  });

  const active = guesses.filter(g => g.wager > 0);
  if (!active.length) {
    alertLike('At least one player must wager points.');
    return null;
  }

  for (const g of active) {
    const available = getAvailablePoints(g.playerId);
    if (g.wager > available) {
      const p = state.players.find(x => x.id === g.playerId);
      alertLike(`${p?.name || 'This player'} only has ${available} available points.`);
      return null;
    }
  }

  return guesses;
}

// After normalizeGuesses
export function validateTableStakes(guesses) {
  // Only look at players who are actually in the round
  const active = guesses.filter(g => g.wager > 0);
  if (!active.length) {
    // No one is playing, let normalizeGuesses handle that case.
    return { ok: false, message: 'At least one player must wager points.' };
  }

  const uniqueWagers = Array.from(new Set(active.map(g => g.wager)));

  if (uniqueWagers.length === 1) {
    // All non-zero wagers are equal
    return { ok: true, target: uniqueWagers[0] };
  }

  return {
    ok: false,
    message: 'Table stakes: everyone who is in must wager the same amount before locking.'
  };
}

// ---------- Bonus helpers ----------

// Get all resolved rounds a player has ever won, ordered oldest -> newest.
export function getResolvedWinsForPlayer(playerId) {
  return state.bets
    .filter(b => b.status === 'resolved' && (b.roundWinners || []).includes(playerId))
    .sort((a, b) => new Date(a.resolvedAt) - new Date(b.resolvedAt));
}

// Manually award a configured bonus to a player.
export function awardBonus(bonusId, playerId) {
  const bonus = state.bonuses.find(b => b.id === bonusId);
  const player = state.players.find(p => p.id === playerId);
  if (!bonus || !player) return;

  player.currentPoints = clampScore(player.currentPoints + bonus.points);

  const latest = state.bets.find(b => b.status === 'resolved');
  const record = {
    id: uid(),
    bonusId: bonus.id,
    bonusName: bonus.name,
    points: bonus.points,
    playerId: player.id,
    playerName: player.name,
    roundId: latest?.id || null,
    reason: bonus.name
  };

  state.awardedBonuses.unshift(record);
  saveState();
  alertLike(`+${bonus.points} to ${player.name} for "${bonus.name}".`);
}

// Compute any automatic bonus awards to apply to a particular resolved round.
export function computeBonusPointsForRound(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return [];

  const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];

  const guesses = bet.guesses || [];
  const bonuses = [];

  // Bonus 1: hidden author (no one guessed them).
  if (correctAuthors.length) {
    const guessedIds = new Set(guesses.map(g => g.guessedAuthorId).filter(Boolean));
    correctAuthors.forEach(authorId => {
      if (!guessedIds.has(authorId)) {
        bonuses.push({ playerId: authorId, amount: 3, reason: 'Hidden author (no one guessed them)' });
      }
    });
  }

  // Bonus 2: three consecutive wins in any land.
  const resolved = state.bets
    .filter(b => b.status === 'resolved')
    .sort((a, b2) => new Date(a.resolvedAt || a.createdAt) - new Date(b2.resolvedAt || b2.createdAt));

  const idx = resolved.findIndex(b => b.id === betId);
  if (idx >= 2) {
    const lastThree = resolved.slice(idx - 2, idx + 1);
    const playerIds = state.players.map(p => p.id);

    playerIds.forEach(pid => {
      const allThreeCorrect = lastThree.every(round => {
        const rCorrect = (round.correctAuthors && round.correctAuthors.length
          ? round.correctAuthors
          : (round.correctAuthorId ? [round.correctAuthorId] : [])) || [];
        return (round.guesses || []).some(g => g.playerId === pid && rCorrect.includes(g.guessedAuthorId));
      });
      if (allThreeCorrect) {
        bonuses.push({ playerId: pid, amount: 3, reason: 'Three wins in a row' });
      }
    });
  }

  // Bonus 3: multiple wins in the same land, across different attractions.
  if (bet.land) {
    const land = bet.land;
    const resolvedInLand = state.bets.filter(
      b => b.status === 'resolved' && b.land === land
    );
    const playerIds = state.players.map(p => p.id);

    playerIds.forEach(pid => {
      const attractionsWithWins = new Set();

      resolvedInLand.forEach(round => {
        const rCorrect = (round.correctAuthors && round.correctAuthors.length
          ? round.correctAuthors
          : (round.correctAuthorId ? [round.correctAuthorId] : [])) || [];

        const guessedCorrect = (round.guesses || []).some(
          g => g.playerId === pid && rCorrect.includes(g.guessedAuthorId)
        );

        if (guessedCorrect) {
          const attr = round.attraction || '';
          if (attr) {
            attractionsWithWins.add(attr);
          }
        }
      });

      // Only award if the player has wins in at least 2 different attractions
      if (attractionsWithWins.size >= 2) {
        bonuses.push({
          playerId: pid,
          amount: 2,
          reason: `Multiple wins in ${land}`
        });
      }
    });
  }

  return bonuses;
}

// ---------- Resolve one round ----------

// Resolve the guessing phase for a round, applying:
// - wagers and payouts (losers pay, winners gain that amount)
// - Hunny Pot updates (including Hot Round)
// - automatic catch-up
// Returns an object describing summary text to render.
export function resolveGuessingBet(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return null;

  const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];

  if (!correctAuthors.length) {
    alertLike('No answer was chosen to guess.');
    return null;
  }

  const guesses = bet.guesses || [];
  const wagers = guesses.map(g => ({
    playerId: g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager: Math.max(0, Number(g.wager || 0))
  }));

  // Auto-add +1 to the current leader's wager (if single clear leader, capped by available points).
  let autoLeaderBoostLine = '';
  if (wagers.length && state.players.length) {
    const rankedNow = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
    const top = rankedNow[0];
    const second = rankedNow[1];
    const clearLeader = top && (!second || top.currentPoints > second.currentPoints);

    if (clearLeader) {
      const leaderId = top.id;
      const leaderWagerObj = wagers.find(w => w.playerId === leaderId);
      if (leaderWagerObj && leaderWagerObj.wager > 0) {
        const available = getAvailablePoints(leaderId);
        const boosted = leaderWagerObj.wager + 1;

        if (boosted <= available) {
          leaderWagerObj.wager = boosted;
          autoLeaderBoostLine = `${top.name} automatically got 1 added to their wager for being in the lead.`;
        } else {
          autoLeaderBoostLine = `${top.name} is in the lead but didn't have an extra point to auto-wager.`;
        }
      }
    }
  }

  // Split wagers into winners and losers.
  const winners = wagers.filter(
    w => w.wager > 0 && correctAuthors.includes(w.guessedAuthorId)
  );
  const losers = wagers.filter(
    w => w.wager > 0 && !correctAuthors.includes(w.guessedAuthorId)
  );
  const anyCorrect = winners.length > 0;

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  // Subtract losing wagers from losers only.
  losers.forEach(w => {
    const player = playerMap[w.playerId];
    if (!player) return;
    player.currentPoints = clampScore(player.currentPoints - w.wager);
  });

  // Build a pot from losers' wagers only.
  const losersPot = losers.reduce((sum, w) => sum + w.wager, 0);

  // Total winning wager, for proportional payouts.
  const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

  // Payout losers' pot among winners.
  if (anyCorrect && losersPot > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share = (losersPot * w.wager) / totalWinnerWager;
      player.currentPoints = clampScore(player.currentPoints + share);
    });
  } else if (!anyCorrect && losersPot > 0) {
    // If no one got it right, losers' wagers go to the Hunny Pot instead.
    state.pot += losersPot;
  }

  // Hot Round extra payout from Hunny Pot (still based on winner wagers).
  const hotRoundLines = [];
  if (bet.hotRound && bet.hotRoundBonus > 0 && anyCorrect && totalWinnerWager > 0 && state.pot > 0) {
    const extraTotal = Math.min(clampScore(bet.hotRoundBonus), clampScore(state.pot));
    if (extraTotal > 0) {
      winners.forEach(w => {
        const player = playerMap[w.playerId];
        if (!player) return;
        const share = (extraTotal * w.wager) / totalWinnerWager;
        const award = clampScore(share);
        if (award <= 0) return;
        player.currentPoints = clampScore(player.currentPoints + award);
        hotRoundLines.push(`${player.name}: +${award} Hot Round bonus`);
      });
      state.pot -= extraTotal;
    }
  }

  // Mark round as resolved before computing bonuses.
  bet.status = 'resolved';
  bet.resolvedAt = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  const roundBonuses = computeBonusPointsForRound(betId);

  // Apply automatic bonus points and record them in state.
  if (roundBonuses.length) {
    roundBonuses.forEach(bonus => {
      const player = playerMap[bonus.playerId];
      if (!player) return;
      player.currentPoints = clampScore(player.currentPoints + bonus.amount);
    });

    const records = roundBonuses.map(b => {
      const p = state.players.find(pl => pl.id === b.playerId);
      return {
        id: uid(),
        bonusId: 'auto',
        bonusName: 'Automatic bonus',
        points: b.amount,
        playerId: b.playerId,
        playerName: p ? p.name : 'Unknown',
        roundId: bet.id,
        reason: b.reason
      };
    });

    bet.bonusAwards = roundBonuses.map(b => ({
      playerId: b.playerId,
      amount: b.amount,
      reason: b.reason
    }));

    state.awardedBonuses.unshift(...records);
  } else {
    bet.bonusAwards = [];
  }

  // Persist the state after payouts and bonuses, before catch-up.
  enforceMinPot();
  saveState();

  const authorNames = correctAuthors
    .map(id => {
      const p = state.players.find(pl => pl.id === id);
      return p ? p.name : null;
    })
    .filter(Boolean);

  const winnerLines = winners
    .map(w => {
      const p = state.players.find(pl => pl.id === w.playerId);
      return p ? `${p.name} (wagered ${w.wager})` : null;
    })
    .filter(Boolean);

  const parts = [];

  // Author section
  parts.push(`<div class="reveal-section-title">Author${authorNames.length > 1 ? 's' : ''}</div>`);
  parts.push(`<div class="hint">${escapeHtml(authorNames.join(', ') || 'Unknown')}</div>`);

  // Attraction / land section
  if (bet.attraction || bet.land) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Attraction</div>`);
    parts.push(
      `<div class="hint" >${escapeHtml(bet.attraction || 'Unknown')} ${
        bet.land ? '(' + escapeHtml(bet.land) + ')' : ''
      }</div>`
    );
  }

  // Optional fun fact, looked up against PARKS data.
  const fact = getFactForBet(bet);
  if (fact) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Fun fact</div>`);
    parts.push(`<div class="hint">${escapeHtml(fact)}</div>`);
  }

  // Hot Round metadata for display.
  if (bet.hotRound && bet.hotRoundBonus > 0) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Hot Round</div>`);
    parts.push(`<div class="hint">This was a Hunny Pot Hot Round with ${bet.hotRoundBonus} extra points available from the Hunny Pot.</div>`);
  }

  // Winner summary.
  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Winners</div>`);
  if (anyCorrect && winnerLines.length) {
    parts.push(`<div class="hint">${winnerLines.map(escapeHtml).join('<br>')}</div>`);
  } else if (losersPot > 0) {
    parts.push(`<div class="hint">No one guessed correctly. All wagers went to the Hunny Pot.</div>`);
  } else {
    parts.push(`<div>No one placed a wager this round.</div>`);
  }

  // Mention the automatic +1 leader wager, if it happened.
  if (autoLeaderBoostLine) {
    parts.push(`<div class="hint" style="margin-top:.25rem;">${escapeHtml(autoLeaderBoostLine)}</div>`);
  }

  // List individual Hot Round bonus payouts (if any).
  if (hotRoundLines.length) {
    parts.push(`<div class="hint">${hotRoundLines.map(escapeHtml).join('<br>')}</div>`);
  }

  // Catch-up mechanic using Hunny Pot to reduce largest gap.
  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  if (state.pot > 0 && ranked.length >= 2) {
    const leader = ranked[0];
    const last = ranked[ranked.length - 1];
    const gap = leader.currentPoints - last.currentPoints;

    if (gap >= 10) {
      const secondLast = ranked[ranked.length - 2];

      const maxToSecondLast = secondLast
        ? Math.max(0, secondLast.currentPoints - last.currentPoints)
        : gap;

      const maxToLeaderMinusOne = Math.max(0, leader.currentPoints - 1 - last.currentPoints);

      const hardCap = Math.min(
        5,              // never give more than 5 at once
        state.pot,      // cannot exceed pot
        maxToSecondLast,
        maxToLeaderMinusOne
      );

      if (hardCap > 0) {
        last.currentPoints = clampScore(last.currentPoints + hardCap);
        state.pot -= hardCap;
        enforceMinPot();

        parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Catch-up</div>`);
        parts.push(
          `<div class="hint">Gave ${hardCap} points from the Hunny Pot to ${escapeHtml(last.name)}.</div>`
        );
      }
    }
  }

  // Save again so scoreboard reflects catch-up.
  saveState();

  const rankedAfter = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Scores after this round</div>`);
  parts.push(
    `<div class="hint">${rankedAfter
      .map(p => `${escapeHtml(p.name)}: ${clampScore(p.currentPoints)}`)
      .join('<br>')}</div>`
  );

  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Hunny Pot</div>`);
  parts.push(`<div class="hint">${state.pot} points</div>`);

  if (roundBonuses && roundBonuses.length) {
    const bonusLines = roundBonuses
      .map(b => {
        const p = state.players.find(pl => pl.id === b.playerId);
        return p ? `${p.name}: +${b.amount} (${b.reason})` : null;
      })
      .filter(Boolean);

    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Bonus points this round</div>`);
    parts.push(`<div class="hint">${bonusLines.map(escapeHtml).join('<br>')}</div>`);
  }

  // Return the HTML summary for the modal body and summary panel.
  return {
    bet,
    html: parts.join('')
  };
}

// ---------- PARK data helpers ----------

// Track which attraction-specific questions have been used already.
export function getUsedSpecificQuestionsForAttraction(attractionName) {
  const parks = window.PARKS;
  if (!parks || !Array.isArray(parks.attractions)) return new Set();

  const attraction = parks.attractions.find(
    a => a.name.toLowerCase() === attractionName.toLowerCase()
  );
  if (!attraction || !Array.isArray(attraction.questions)) return new Set();

  const specificQuestions = new Set(attraction.questions);
  const used = new Set();

  state.bets
    .filter(b => b.description)
    .forEach(bet => {
      if (
        bet.attraction &&
        bet.attraction.toLowerCase() === attractionName.toLowerCase() &&
        specificQuestions.has(bet.description)
      ) {
        used.add(bet.description);
      }
    });

  return used;
}

// Which global questions have been used at least once.
export function getUsedGlobalQuestions() {
  const globalPool = new Set(window.DISNEY_LINE_QUESTIONS || []);
  const used = new Set();

  state.bets
    .filter(b => b.description)
    .forEach(bet => {
      if (globalPool.has(bet.description)) {
        used.add(bet.description);
      }
    });

  return used;
}

// Random global question that hasn't been used yet (if any).
export function getRandomUnusedGlobalQuestion() {
  const globalPool = window.DISNEY_LINE_QUESTIONS || [];
  const usedGlobal = getUsedGlobalQuestions();
  const unusedGlobal = globalPool.filter(q => !usedGlobal.has(q));

  if (unusedGlobal.length) {
    return unusedGlobal[Math.floor(Math.random() * unusedGlobal.length)];
  }

  if (!globalPool.length) return '';
  return globalPool[Math.floor(Math.random() * globalPool.length)];
}

// Look up a fun fact for an attraction from PARKS data.
export function getFactForBet(bet) {
  if (!bet || !bet.attraction) return '';

  const parks = window.PARKS;
  const attractions = parks && Array.isArray(parks.attractions)
    ? parks.attractions
    : [];

  const attraction = attractions.find(
    a => a.name.toLowerCase() === bet.attraction.toLowerCase()
  );

  if (!attraction || !attraction.fact) return '';
  return attraction.fact;
}

// Choose a question based on the current attraction, falling back
// to the global pool if needed.
export function getRandomQuestionForAttractionWithFallback(attractionName) {
  const name = attractionName?.trim();
  if (!name) {
    const pool = window.DISNEY_LINE_QUESTIONS || [];
    if (!pool.length) return '';
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  const parks = window.PARKS;
  const attractions = parks && Array.isArray(parks.attractions)
    ? parks.attractions
    : [];

  const attraction = attractions.find(
    a => a.name.toLowerCase() === name.toLowerCase()
  );

  const specific = attraction && Array.isArray(attraction.questions)
    ? attraction.questions
    : [];

  const usedSpecific = getUsedSpecificQuestionsForAttraction(name);
  const unusedSpecific = specific.filter(q => !usedSpecific.has(q));

  if (unusedSpecific.length > 0) {
    const idx = Math.floor(Math.random() * unusedSpecific.length);
    return unusedSpecific[idx];
  }

  const globalPool = window.DISNEY_LINE_QUESTIONS || [];
  if (!globalPool.length) return '';

  const idx = Math.floor(Math.random() * globalPool.length);
  return globalPool[idx];
}
