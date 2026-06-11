// ---------- Hot Round ----------
function openHotRoundModal(onSubmit) {
  if (!els.hotRoundBackdrop || !els.hotRoundInput) {
    onSubmit({ hotRound: false, hotRoundBonus: 0 });
    return;
  }

  const max = state.pot;
  els.hotRoundMessage.textContent =
    `The Hunny Pot has ${max} points. Make this a Hunny Pot Hot Round and give extra pot points to the winner?`;
  els.hotRoundInput.value = String(Math.min(5, max));
  els.hotRoundInput.min = '1';
  els.hotRoundInput.max = String(max);

  const close = () => {
    els.hotRoundBackdrop.style.display = 'none';
    els.hotRoundConfirm.removeEventListener('click', onConfirm);
    els.hotRoundSkip.removeEventListener('click', onSkip);
    els.hotRoundCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    let amount = Number(els.hotRoundInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alertLike('Enter a number greater than 0.');
      return;
    }
    if (amount > max) amount = max;
    close();
    onSubmit({ hotRound: true, hotRoundBonus: clampScore(amount) });
  };

  const onSkip = () => {
    close();
    onSubmit({ hotRound: false, hotRoundBonus: 0 });
  };

  const onCancel = () => {
    close();
  };

  els.hotRoundConfirm.addEventListener('click', onConfirm);
  els.hotRoundSkip.addEventListener('click', onSkip);
  els.hotRoundCancel.addEventListener('click', onCancel);

  els.hotRoundBackdrop.style.display = 'flex';
  els.hotRoundInput.focus();
}

// ---------- Bets / guessing ----------
function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

function setChosenAnswerForBet(bet, chosen) {
  if (!bet || !chosen) return;
  bet.chosenAnswerId = chosen.id;

  const sameTextAuthors = bet.answers
    .filter(a => a.text === chosen.text)
    .map(a => a.playerId);

  bet.correctAuthors = sameTextAuthors;
  bet.correctAuthorId = sameTextAuthors[0] || null;
}

function chooseRandomAnswerForBet(bet) {
  if (!bet || !Array.isArray(bet.answers) || !bet.answers.length) return;
  const idx = Math.floor(Math.random() * bet.answers.length);
  const chosen = bet.answers[idx];
  setChosenAnswerForBet(bet, chosen);
}

function rerollChosenAnswer(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || !Array.isArray(bet.answers) || bet.answers.length < 2) {
    alertLike('There is not another answer available to choose.');
    return;
  }

  const currentId = bet.chosenAnswerId;
  const alternatives = bet.answers.filter(a => a.id !== currentId);

  if (!alternatives.length) {
    alertLike('There is not another answer available to choose.');
    return;
  }

  const next = alternatives[Math.floor(Math.random() * alternatives.length)];
  setChosenAnswerForBet(bet, next);
  saveState();
  render();
}

function rerollCurrentSelectedAnswer() {
  const bet = getCurrentGuessingBet();
  if (!bet) {
    alertLike('No round is ready right now.');
    return;
  }
  rerollChosenAnswer(bet.id);
}

window.rerollCurrentSelectedAnswer = rerollCurrentSelectedAnswer;

function finalizeCreateBet(options) {
  if (!state.players || state.players.length < 2) {
    alertLike('You need at least two family members to play.');
    return;
  }

  const attraction = els.attractionName.value.trim();
  const land = els.landName.value.trim();
  const question = els.betDescription.value.trim();

  if (!attraction || !land || !question) {
    alertLike('Attraction, Land, and Question are all required.');
    return;
  }

  const betId = uid();
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
    status: 'answering',
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
    hotRound: !!options.hotRound,
    hotRoundBonus: clampScore(options.hotRoundBonus || 0)
  };

  state.bets.unshift(bet);
  els.betDescription.value = '';
  saveState();
  render();
  startAnswerPhase(betId);
}

function createBet() {
  if (!state.players || state.players.length < 2) {
    alertLike('You need at least two family members to play.');
    return;
  }

  const attraction = els.attractionName.value.trim();
  const land = els.landName.value.trim();
  const question = els.betDescription.value.trim();

  if (!attraction || !land || !question) {
    alertLike('Attraction, Land, and Question are all required.');
    return;
  }

  // If pot is healthy, offer Hot Round
  if (state.pot > 10) {
    openHotRoundModal(selection => {
      if (!selection) return;
      finalizeCreateBet(selection);
    });
  } else {
    finalizeCreateBet({ hotRound: false, hotRoundBonus: 0 });
  }
}

// ---------- Answer collection ----------
let currentAnswerBetId = null;
let currentAnswerIndex = 0;

function showAnswerModal() {
  els.answerBackdrop.style.display = 'flex';
}
function hideAnswerModal() {
  els.answerBackdrop.style.display = 'none';
}

function startAnswerPhase(betId) {
  currentAnswerBetId = betId;
  currentAnswerIndex = 0;
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
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
  nextAnswerPrompt();
}

function nextAnswerPrompt() {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

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
    hideAnswerModal();
    render();
    goToWager();
    return;
  }

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    currentAnswerIndex += 1;
    nextAnswerPrompt();
    return;
  }

  const metaParts = [];
  if (bet.attraction) metaParts.push(bet.attraction);
  if (bet.land) metaParts.push(bet.land);
  const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}. Only they should see this screen.\n\nQuestion: ${bet.description} ${meta}`;

  els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
  els.answerInput.value = '';

  if (els.answerGhostBtn) {
    els.answerGhostBtn.disabled = !!bet.ghostAnswerUsed;
    els.answerGhostBtn.style.display = bet.ghostAnswerUsed ? 'none' : '';
  }

  showAnswerModal();
}

els.answerSaveBtn.addEventListener('click', () => {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);
  const text = els.answerInput.value.trim();

  if (!text) {
    alertLike('Type an answer before saving.');
    return;
  }

  if (!player) {
    currentAnswerIndex += 1;
    nextAnswerPrompt();
    return;
  }

  bet.answers.push({ id: uid(), playerId: player.id, text });
  saveState();
  currentAnswerIndex += 1;
  nextAnswerPrompt();
});

if (els.answerCancelBtn) {
  els.answerCancelBtn.addEventListener('click', () => {
    hideAnswerModal();
  });
}

if (els.answerGhostBtn) {
  els.answerGhostBtn.addEventListener('click', () => {
    if (typeof window.getRandomRideFragment !== 'function') {
      alertLike('No ride fragments are available right now.');
      return;
    }

    const bet = state.bets.find(b => b.id === currentAnswerBetId);
    if (!bet) return;

    if (bet.ghostAnswerUsed) {
      alertLike('The ghost answer has already been used this round.');
      return;
    }

    const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
      ? bet.answerOrder
      : state.players.map(p => p.id);

    const playerId = order[currentAnswerIndex];
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      currentAnswerIndex += 1;
      nextAnswerPrompt();
      return;
    }

    const text = window.getRandomRideFragment();

    bet.answers.push({ id: uid(), playerId: player.id, text });
    bet.ghostAnswerUsed = true;
    saveState();
    currentAnswerIndex += 1;
    nextAnswerPrompt();
  });
}

// ---------- Guessing & wagering ----------
function startGuessPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
  if (!bet.answers || !bet.answers.length) return;

  if (!bet.chosenAnswerId) {
    chooseRandomAnswerForBet(bet);
  }

  if (!Array.isArray(bet.wagerOrder) || !bet.wagerOrder.length) {
    bet.wagerOrder = shuffle(state.players.map(p => p.id));
  }

  saveState();
  renderGuessingRound(bet);
}

function renderGuessingRound() {
  renderBetRows();
}

function renderBetRows() {
  if (!state.players.length) {
    els.betPlayers.innerHTML = '<div class="empty">Add players, then start a round.</div>';
    return;
  }

  const guessingBet = getCurrentGuessingBet();
  const bet = guessingBet;
  const order = bet && Array.isArray(bet.wagerOrder) && bet.wagerOrder.length
    ? bet.wagerOrder
    : state.players.map(p => p.id);

  els.betPlayers.innerHTML = order.map(playerId => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return '';
    const available = getAvailablePoints(player.id);
    return `
      <div class="player-bet-row" data-bet-player-row data-player-id="${player.id}">
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <div class="hint">Available ${available} points</div>
        </div>
        <div class="field">
          <label>Who said it?</label>
          <select data-guess-player ${guessingBet ? '' : 'disabled'}>
            ${
              guessingBet
                ? state.players
                    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
                    .join('')
                : ''
            }
          </select>
        </div>
        <div class="field">
          <label>Wager</label>
          <input data-amount type="number" min="0" step="1" value="1" placeholder="1" inputmode="numeric" pattern="[0-9]*" ${
            guessingBet ? '' : 'disabled'
          } />
        </div>
      </div>
    `;
  }).join('');

  attachWagerGuards();
}

function attachWagerGuards() {
  const rows = [...document.querySelectorAll('[data-bet-player-row]')];
  rows.forEach(row => {
    const playerId = row.dataset.playerId;
    const input = row.querySelector('[data-amount]');
    if (!input) return;

    input.addEventListener('input', () => {
      const available = getAvailablePoints(playerId);
      const raw = input.value.trim();

      if (raw === '') return;
      if (raw === '0') return;

      let value = Number(raw);
      if (!Number.isFinite(value)) return;

      if (value > available) {
        input.value = String(available);
        alertLike(`That's the max they can wager this round (${available} points).`);
      }
    });

    input.addEventListener('blur', () => {
      const available = getAvailablePoints(playerId);
      const raw = input.value.trim();

      if (raw === '') {
        input.value = '1';
        return;
      }

      let value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        input.value = '1';
        return;
      }

      if (value > available) {
        input.value = String(available);
      }
    });
  });
}

function buildGuessesForBet(bet) {
  const rows = [...document.querySelectorAll('[data-bet-player-row]')];
  const guesses = rows.map(row => {
    const playerId = row.dataset.playerId;
    const select = row.querySelector('[data-guess-player]');
    const input = row.querySelector('[data-amount]');
    const guessedAuthorId = select ? select.value : null;
    let wager = Number(input ? input.value : 0) || 0;
    if (!Number.isFinite(wager) || wager < 0) wager = 0;
    const available = getAvailablePoints(playerId);
    if (wager > available) wager = available;
    return { playerId, guessedAuthorId, wager };
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

// ---------- Bonus helpers ----------
function getResolvedWinsForPlayer(playerId) {
  return state.bets
    .filter(b => b.status === 'resolved' && (b.roundWinners || []).includes(playerId))
    .sort((a, b) => new Date(a.resolvedAt) - new Date(b.resolvedAt));
}

function awardBonus(bonusId, playerId) {
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
  render();
  alertLike(`+${bonus.points} to ${player.name} for "${bonus.name}".`);
}

window.awardBonus = awardBonus;

function computeBonusPointsForRound(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== 'resolved') return [];

  const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];

  const guesses = bet.guesses || [];
  const bonuses = [];

  if (correctAuthors.length) {
    const guessedIds = new Set(guesses.map(g => g.guessedAuthorId).filter(Boolean));
    correctAuthors.forEach(authorId => {
      if (!guessedIds.has(authorId)) {
        bonuses.push({ playerId: authorId, amount: 3, reason: 'Hidden author (no one guessed them)' });
      }
    });
  }

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

  if (bet.land) {
    const land = bet.land;
    const resolvedInLand = state.bets.filter(b => b.status === 'resolved' && b.land === land);
    const playerIds = state.players.map(p => p.id);

    playerIds.forEach(pid => {
      let winsInLand = 0;
      resolvedInLand.forEach(round => {
        const rCorrect = (round.correctAuthors && round.correctAuthors.length
          ? round.correctAuthors
          : (round.correctAuthorId ? [round.correctAuthorId] : [])) || [];
        const guessedCorrect = (round.guesses || []).some(
          g => g.playerId === pid && rCorrect.includes(g.guessedAuthorId)
        );
        if (guessedCorrect) winsInLand += 1;
      });
      if (winsInLand >= 2) {
        bonuses.push({ playerId: pid, amount: 2, reason: `Multiple wins in ${land}` });
      }
    });
  }

  return bonuses;
}

// ---------- Resolve one round ----------
function resolveGuessingBet(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];

  if (!correctAuthors.length) {
    alertLike('No answer was chosen to guess.');
    return;
  }

  const guesses = bet.guesses || [];
  const wagers = guesses.map(g => ({
    playerId: g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager: Math.max(0, Number(g.wager || 0))
  }));

  const potThisRound = wagers.reduce((sum, w) => sum + w.wager, 0);
  const winners = wagers.filter(
    w => w.wager > 0 && correctAuthors.includes(w.guessedAuthorId)
  );
  const anyCorrect = winners.length > 0;

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  wagers.forEach(w => {
    const player = playerMap[w.playerId];
    if (!player || w.wager <= 0) return;
    if (correctAuthors.includes(w.playerId)) return;
    player.currentPoints = clampScore(player.currentPoints - w.wager);
  });

  const totalWinnerWager = winners.reduce((s, w) => s + w.wager, 0);
  if (anyCorrect && potThisRound > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      if (correctAuthors.includes(w.playerId)) return;
      const share = (potThisRound * w.wager) / totalWinnerWager;
      player.currentPoints = clampScore(player.currentPoints + share);
    });
  } else if (!anyCorrect && potThisRound > 0) {
    state.pot += potThisRound;
  }

  // Hot Round extra payout from Hunny Pot
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

  bet.status = 'resolved';
  bet.resolvedAt = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  const roundBonuses = computeBonusPointsForRound(betId);

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

  enforceMinPot();
  saveState();
  render();

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

  parts.push(`<div class="reveal-section-title">Author${authorNames.length > 1 ? 's' : ''}</div>`);
  parts.push(`<div class="hint">${escapeHtml(authorNames.join(', ') || 'Unknown')}</div>`);

  if (bet.attraction || bet.land) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Attraction</div>`);
    parts.push(
      `<div class="hint" >${escapeHtml(bet.attraction || 'Unknown')} ${bet.land ? '(' + escapeHtml(bet.land) + ')' : ''}</div>`
    );
  }

  const fact = getFactForBet(bet);
  if (fact) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Fun fact</div>`);
    parts.push(`<div class="hint">${escapeHtml(fact)}</div>`);
  }

  if (bet.hotRound && bet.hotRoundBonus > 0) {
    parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Hot Round</div>`);
    parts.push(`<div>This was a Hunny Pot Hot Round with ${bet.hotRoundBonus} extra points available from the Hunny Pot.</div>`);
  }

  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Winners</div>`);
  if (anyCorrect && winnerLines.length) {
    parts.push(`<div class="hint">${winnerLines.map(escapeHtml).join('<br>')}</div>`);
  } else if (potThisRound > 0) {
    parts.push(`<div>No one guessed correctly. All wagers went to the Hunny Pot.</div>`);
  } else {
    parts.push(`<div>No one placed a wager this round.</div>`);
  }

  if (hotRoundLines.length) {
    parts.push(`<div>Hot Round bonus</div>`);
    parts.push(`<div>${hotRoundLines.map(escapeHtml).join('<br>')}</div>`);
  }

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
        5,
        state.pot,
        maxToSecondLast,
        maxToLeaderMinusOne
      );

      if (hardCap > 0) {
        last.currentPoints = clampScore(last.currentPoints + hardCap);
        state.pot -= hardCap;
        enforceMinPot();

        parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Catch-up</div>`);
        parts.push(
          `<div>Gave ${hardCap} points from the Hunny Pot to ${escapeHtml(last.name)} (without passing anyone).</div>`
        );
      }
    }
  }

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
    parts.push(`<div>${bonusLines.map(escapeHtml).join('<br>')}</div>`);
  }

  if (els.revealSummary) {
    els.revealSummary.innerHTML = parts.join('');
  }

  els.revealTitle.textContent = 'Round result';
  els.revealSub.textContent = 'Here is who said the answer and how the points changed.';
  els.revealBody.innerHTML = parts.join('');
  els.revealBackdrop.style.display = 'none';

  goToReveal();
}

els.revealCloseBtn?.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});

els.revealBackdrop?.addEventListener('click', event => {
  if (event.target === els.revealBackdrop) {
    els.revealBackdrop.style.display = 'none';
  }
});

// ---------- Reuse question ----------
function reuseQuestion(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  els.attractionName.value = bet.attraction || '';
  els.landName.value = bet.land || '';
  els.betDescription.value = bet.description || '';

  goToQuestion();
}
window.reuseQuestion = reuseQuestion;

// ---------- Question pools / facts ----------
function getUsedSpecificQuestionsForAttraction(attractionName) {
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

function getUsedGlobalQuestions() {
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

function getRandomUnusedGlobalQuestion() {
  const globalPool = window.DISNEY_LINE_QUESTIONS || [];
  const usedGlobal = getUsedGlobalQuestions();
  const unusedGlobal = globalPool.filter(q => !usedGlobal.has(q));

  if (unusedGlobal.length) {
    return unusedGlobal[Math.floor(Math.random() * unusedGlobal.length)];
  }

  if (!globalPool.length) return '';
  return globalPool[Math.floor(Math.random() * globalPool.length)];
}

function getFactForBet(bet) {
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

function getRandomQuestionForAttractionWithFallback() {
  const attractionName = els.attractionName.value.trim();

  if (!attractionName) {
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
    a => a.name.toLowerCase() === attractionName.toLowerCase()
  );

  const specific = attraction && Array.isArray(attraction.questions)
    ? attraction.questions
    : [];

  const usedSpecific = getUsedSpecificQuestionsForAttraction(attractionName);
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
