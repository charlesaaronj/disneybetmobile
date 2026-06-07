// === Who Said Diz with bonus panel ===

// ---------- State ----------
const state = {
  players: [],
  bets: [],
  pot: 0,

  // Built‑in bonus rules (manual award via buttons)
  bonuses: [
    {
      id: 'noGuessAuthor',
      name: 'No one guessed the author',
      points: 1,
      active: true,
      description: 'If nobody guesses correctly, the real author gets +1 point.'
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
  awardedBonuses: []
};

const STORAGE_KEY = 'disney-line-bet-v1';

const els = {
  playerName: document.getElementById('playerName'),
  playerPoints: document.getElementById('playerPoints'),
  playersList: document.getElementById('playersList'),
  scoreboard: document.getElementById('scoreboard'),
  betPlayers: document.getElementById('betPlayers'),
  betDescription: document.getElementById('betDescription'),
  attractionName: document.getElementById('attractionName'),
  landName: document.getElementById('landName'),
  openBets: document.getElementById('openBets'),
  historyList: document.getElementById('historyList'),
  openBetMetrics: document.getElementById('openBetMetrics'),
  selectedAnswerPanel: document.getElementById('selectedAnswerPanel'),

  answerBackdrop: document.getElementById('answerModalBackdrop'),
  answerPrompt: document.getElementById('answerModalPrompt'),
  answerPlayerLabel: document.getElementById('answerModalPlayerLabel'),
  answerInput: document.getElementById('answerModalInput'),
  answerSaveBtn: document.getElementById('answerModalSaveBtn'),
  answerCancelBtn: document.getElementById('answerModalCancelBtn'),

  revealBackdrop: document.getElementById('revealModalBackdrop'),
  revealTitle: document.getElementById('revealModalTitle'),
  revealSub: document.getElementById('revealModalSub'),
  revealBody: document.getElementById('revealModalBody'),
  revealCloseBtn: document.getElementById('revealModalCloseBtn'),

  addHunnyBackdrop: document.getElementById('addHunnyModalBackdrop'),
  addHunnyInput: document.getElementById('addHunnyModalInput'),
  addHunnyCancel: document.getElementById('addHunnyModalCancel'),
  addHunnyConfirm: document.getElementById('addHunnyModalConfirm'),

  giveHunnyBackdrop: document.getElementById('giveHunnyModalBackdrop'),
  giveHunnyMessage: document.getElementById('giveHunnyModalMessage'),
  giveHunnyInput: document.getElementById('giveHunnyModalInput'),
  giveHunnyCancel: document.getElementById('giveHunnyModalCancel'),
  giveHunnyConfirm: document.getElementById('giveHunnyModalConfirm'),

  clearHunnyBackdrop: document.getElementById('clearHunnyModalBackdrop'),
  clearHunnyMessage: document.getElementById('clearHunnyModalMessage'),
  clearHunnyCancel: document.getElementById('clearHunnyModalCancel'),
  clearHunnyConfirm: document.getElementById('clearHunnyModalConfirm'),

  // Bonus-related panels
  qualifiedBonusPanel: document.getElementById('qualifiedBonusPanel'),
  bonusLibrary: document.getElementById('bonusLibrary')
};

// ---------- Small helpers ----------
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function clampScore(x) {
  return Math.max(0, Math.round(x));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}
function alertLike(message) {
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

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
function loadState() {
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
  } catch {}
}

function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
}
function getPlayerName(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

// ---------- Players ----------
function addPlayer(name, startingPoints) {
  state.players.push({
    id: uid(),
    name: name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints: clampScore(startingPoints)
  });
  saveState();
  render();
}

function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  state.bets = state.bets.filter(
    bet => !bet.guesses?.some(g => g.playerId === playerId)
  );
  saveState();
  render();
}

// ---------- Hunny Pot ----------
function giveFromPot(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  if (state.pot <= 0) {
    alertLike('No points in the Hunny Pot right now.');
    return;
  }

  const max = state.pot;
  els.giveHunnyMessage.textContent =
    `How many points do you want to give to ${player.name} from the Hunny Pot? (Max ${max})`;
  els.giveHunnyInput.value = String(max);
  els.giveHunnyInput.min = '1';
  els.giveHunnyInput.max = String(max);

  const close = () => {
    els.giveHunnyBackdrop.style.display = 'none';
    els.giveHunnyConfirm.removeEventListener('click', onConfirm);
    els.giveHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    let amount = Number(els.giveHunnyInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alertLike('Enter a number greater than 0.');
      return;
    }
    if (amount > max) amount = max;

    state.pot -= amount;
    player.currentPoints = clampScore(player.currentPoints + amount);
    saveState();
    render();
    close();
  };

  const onCancel = () => {
    close();
  };

  els.giveHunnyConfirm.addEventListener('click', onConfirm);
  els.giveHunnyCancel.addEventListener('click', onCancel);

  els.giveHunnyBackdrop.style.display = 'flex';
  els.giveHunnyInput.focus();
}

function addToPot() {
  els.addHunnyInput.value = '5';
  els.addHunnyInput.min = '1';

  const close = () => {
    els.addHunnyBackdrop.style.display = 'none';
    els.addHunnyConfirm.removeEventListener('click', onConfirm);
    els.addHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    let amount = Number(els.addHunnyInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alertLike('Enter a number greater than 0.');
      return;
    }

    state.pot += amount;
    saveState();
    render();
    close();
  };

  const onCancel = () => {
    close();
  };

  els.addHunnyConfirm.addEventListener('click', onConfirm);
  els.addHunnyCancel.addEventListener('click', onCancel);

  els.addHunnyBackdrop.style.display = 'flex';
  els.addHunnyInput.focus();
}

function clearPot() {
  if (!state.pot) return;

  els.clearHunnyMessage.textContent =
    `Clear the Hunny Pot (${state.pot} points)?`;

  const close = () => {
    els.clearHunnyBackdrop.style.display = 'none';
    els.clearHunnyConfirm.removeEventListener('click', onConfirm);
    els.clearHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    state.pot = 0;
    saveState();
    render();
    close();
  };

  const onCancel = () => {
    close();
  };

  els.clearHunnyConfirm.addEventListener('click', onConfirm);
  els.clearHunnyCancel.addEventListener('click', onCancel);

  els.clearHunnyBackdrop.style.display = 'flex';
}

window.addToPot = addToPot;
window.clearPot = clearPot;
window.giveFromPot = giveFromPot;
window.removePlayer = removePlayer;

// ---------- Bets / guessing ----------
function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

function createBet() {
  if (!state.players.length) {
    alertLike('Add family members before starting a round.');
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
    bonusAwards: []
  };

  state.bets.unshift(bet);
  els.betDescription.value = '';
  els.attractionName.value = '';
  els.landName.value = '';
  saveState();
  render();
  startAnswerPhase(betId);
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
  saveState();
  nextAnswerPrompt();
}

function nextAnswerPrompt() {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const players = state.players;
  if (currentAnswerIndex >= players.length) {
    bet.status = 'guessing';

    if (!bet.chosenAnswerId && bet.answers.length) {
      const idx = Math.floor(Math.random() * bet.answers.length);
      const chosen = bet.answers[idx];
      bet.chosenAnswerId = chosen.id;

      const sameTextAuthors = bet.answers
        .filter(a => a.text === chosen.text)
        .map(a => a.playerId);

      bet.correctAuthors = sameTextAuthors;
      bet.correctAuthorId = sameTextAuthors[0] || null;
    }

    saveState();
    hideAnswerModal();
    render();
    return;
  }

  const player = players[currentAnswerIndex];
  const metaParts = [];
  if (bet.attraction) metaParts.push(bet.attraction);
  if (bet.land) metaParts.push(bet.land);
  const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}. Only they should see this screen.\n\nQuestion: ${bet.description} ${meta}`;

  els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
  els.answerInput.value = '';
  showAnswerModal();
}

els.answerSaveBtn.addEventListener('click', () => {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const players = state.players;
  const player = players[currentAnswerIndex];
  const text = els.answerInput.value.trim();

  if (!text) {
    alertLike('Type an answer before saving.');
    return;
  }

  bet.answers.push({ id: uid(), playerId: player.id, text });
  saveState();
  currentAnswerIndex += 1;
  nextAnswerPrompt();
});

// Cancel button: just hide the modal (do not abandon the round)
if (els.answerCancelBtn) {
  els.answerCancelBtn.addEventListener('click', () => {
    hideAnswerModal();
  });
}

// click outside answer modal closes it (disabled)
// els.answerBackdrop.addEventListener('click', event => {
//   if (event.target === els.answerBackdrop) {
//     hideAnswerModal();
//   }
// });

// ---------- Guessing & wagering ----------
function startGuessPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
  if (!bet.answers || !bet.answers.length) return;

  if (!bet.chosenAnswerId) {
    const idx = Math.floor(Math.random() * bet.answers.length);
    const chosen = bet.answers[idx];
    bet.chosenAnswerId = chosen.id;
    const sameTextAuthors = bet.answers
      .filter(a => a.text === chosen.text)
      .map(a => a.playerId);
    bet.correctAuthors = sameTextAuthors;
    bet.correctAuthorId = sameTextAuthors[0] || null;
    saveState();
  }

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
  els.betPlayers.innerHTML = state.players.map(player => {
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
          <input data-amount type="number" min="0" step="1" value="0" placeholder="0" inputmode="numeric" pattern="[0-9]*" ${
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
      let value = Number(input.value) || 0;
      if (!Number.isFinite(value) || value < 0) value = 0;
      if (value > available) {
        value = available;
        alertLike(`That's the max they can wager this round (${available} points).`);
      }
      input.value = value;
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

  // 1) Hidden author bonus: chosen author and nobody guessed them
  if (correctAuthors.length) {
    const guessedIds = new Set(guesses.map(g => g.guessedAuthorId).filter(Boolean));
    correctAuthors.forEach(authorId => {
      if (!guessedIds.has(authorId)) {
        bonuses.push({ playerId: authorId, amount: 1, reason: 'Hidden author (no one guessed them)' });
      }
    });
  }

  // 2) Three-in-a-row streak bonus
  // Look at last 3 resolved rounds in time order
  const resolved = state.bets
    .filter(b => b.status === 'resolved')
    .sort((a, b2) => new Date(a.resolvedAt || a.createdAt) - new Date(b2.resolvedAt || b2.createdAt));

  const idx = resolved.findIndex(b => b.id === betId);
  if (idx >= 2) {
    const lastThree = resolved.slice(idx - 2, idx + 1);
    // For each player, check if they were correct in all three
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

  // 3) Land streak bonus: more than two wins in the same land
  if (bet.land) {
    const land = bet.land;
    const resolvedInLand = state.bets.filter(b => b.status === 'resolved' && b.land === land);
    const playerIds = state.players.map(p => p.id);

    playerIds.forEach(pid => {
      // Count wins for this player in this land
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

  // 1) subtract all wagers
  wagers.forEach(w => {
    const player = playerMap[w.playerId];
    if (!player || w.wager <= 0) return;
    player.currentPoints = clampScore(player.currentPoints - w.wager);
  });

  // 2) either pay winners or send pot to Hunny Pot
  const totalWinnerWager = winners.reduce((s, w) => s + w.wager, 0);
  if (anyCorrect && potThisRound > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share = (potThisRound * w.wager) / totalWinnerWager;
      player.currentPoints = clampScore(player.currentPoints + share);
    });
  } else if (!anyCorrect && potThisRound > 0) {
    state.pot += potThisRound;
  }

  // Mark round winners for history
  bet.status = 'resolved';
  bet.resolvedAt = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  // ---------- AUTOMATIC BONUS POINTS ----------
  // Compute per-round bonuses:
  // - +3 for three wins in a row
  // - +2 for >2 wins in the same land
  // - +1 for chosen author when nobody guesses them
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

    // Add automatic bonuses into the shared history list
    state.awardedBonuses.unshift(...records);
  } else {
    bet.bonusAwards = [];
  }
  // ---------- END AUTOMATIC BONUS POINTS ----------

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
  parts.push(`<div>${escapeHtml(authorNames.join(', ') || 'Unknown')}</div>`);
  if (bet.attraction || bet.land) {
    parts.push(
      `<div class="hint">Attraction: ${escapeHtml(bet.attraction || 'Unknown')} ${bet.land ? '(' + escapeHtml(bet.land) + ')' : ''}</div>`
    );
  }

  // Fun fact from parks-data
  const fact = getFactForBet(bet);
  if (fact) {
    parts.push(
      `<div class="hint" style="margin-top:.5rem;"><strong>Fun fact:</strong> ${escapeHtml(fact)}</div>`
    );
  }

  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Winners</div>`);
  if (anyCorrect && winnerLines.length) {
    parts.push(`<div>${winnerLines.map(escapeHtml).join('<br>')}</div>`);
  } else if (potThisRound > 0) {
    parts.push(`<div>No one guessed correctly. All wagers went to the Hunny Pot.</div>`);
  } else {
    parts.push(`<div>No one placed a wager this round.</div>`);
  }

  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Scores after this round</div>`);
  parts.push(
    `<div>${ranked
      .map(p => `${escapeHtml(p.name)}: ${clampScore(p.currentPoints)}`)
      .join('<br>')}</div>`
  );
  parts.push(`<div class="hint" style="margin-top:.75rem;">Hunny Pot is now ${state.pot} points.</div>`);

  // Show automatic bonuses in the modal
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
  els.revealTitle.textContent = 'Round result';
  els.revealSub.textContent = 'Here is who said the answer and how the points changed.';
  els.revealBody.innerHTML = parts.join('');
  els.revealBackdrop.style.display = 'flex';
}

els.revealCloseBtn.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});

els.revealBackdrop.addEventListener('click', event => {
  if (event.target === els.revealBackdrop) {
    els.revealBackdrop.style.display = 'none';
  }
});

// ---------- Rendering ----------
function renderPlayers() {
  if (!state.players.length) {
    els.playersList.innerHTML = '<div class="empty">No family members yet. Add names above to begin.</div>';
    return;
  }

  const potHtml = `
    <div class="player-chip" style="margin-bottom:.5rem;">
      <div>
        <div class="small-actions-hunny" style="margin-top:.25rem;">
          <span class="pill pot-pill-total">Hunny Pot ${state.pot}</span>
          <button class="btn btn-secondary" type="button" onclick="addToPot()">Add Pts</button>
          <button class="btn btn-danger" type="button" onclick="clearPot()">Clear</button>
        </div>
      </div>
    </div>
  `;

  const playersHtml = state.players.map(p => {
    const canReceive = clampScore(p.currentPoints) === 0 && state.pot > 0;
    return `
      <div class="player-chip">
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="hint">Starts with ${p.startingPoints} points</div>
        </div>
        <div>
          <div class="small-actions">
            <span class="pill pill-open">${clampScore(p.currentPoints)} now</span>
            ${
              canReceive
                ? `<button class="btn btn-secondary" type="button" onclick="giveFromPot('${p.id}')">Give from Hunny Pot</button>`
                : ''
            }
            <button class="btn btn-danger" type="button" onclick="removePlayer('${p.id}')">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  els.playersList.innerHTML = potHtml + playersHtml;
}

function renderScoreboard() {
  if (!state.players.length) {
    els.scoreboard.innerHTML = '<div class="empty">Scores will appear here once players are added.</div>';
    return;
  }

  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  els.scoreboard.innerHTML = ranked.map((p, i) => `
    <div class="score-card">
      <div class="hint">${i === 0 ? 'Leader' : 'Place ' + (i + 1)}</div>
      <div class="score-name">${escapeHtml(p.name)}</div>
      <div class="score-points">${clampScore(p.currentPoints)}</div>
      <div class="hint">Started with ${p.startingPoints}</div>
    </div>
  `).join('');
}

function renderOpenMetrics() {
  const answering = state.bets.filter(b => b.status === 'answering').length;
  const guessing = state.bets.filter(b => b.status === 'guessing').length;
  const resolved = state.bets.filter(b => b.status === 'resolved').length;

  els.openBetMetrics.innerHTML = `
    <div class="metric">
      <span class="hint">Answering rounds</span>
      <span class="metric-value">${answering}</span>
    </div>
    <div class="metric">
      <span class="hint">Guessing rounds</span>
      <span class="metric-value">${guessing}</span>
    </div>
    <div class="metric">
      <span class="hint">Resolved rounds</span>
      <span class="metric-value">${resolved}</span>
    </div>
    <div class="metric">
      <span class="hint">Hunny Pot</span>
      <span class="metric-value">${state.pot}</span>
    </div>
  `;
}

function renderOpenBets() {
  const open = state.bets.filter(b => b.status !== 'resolved');
  if (!open.length) {
    els.openBets.innerHTML = '<div class="empty">No active rounds. Start a new question above.</div>';
    return;
  }

  els.openBets.innerHTML = open.map(bet => {
    const statusLabel = bet.status === 'answering'
      ? 'Collecting answers'
      : bet.status === 'guessing'
      ? 'Guessing & wagering'
      : 'Round';

    const metaParts = [];
    if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
    if (bet.land) metaParts.push(escapeHtml(bet.land));
    const meta = metaParts.length ? metaParts.join(' • ') : '';

    return `
      <article class="bet-card">
        <div class="bet-head">
          <div>
            <h3>${escapeHtml(bet.description)}</h3>
            <div class="hint">Created ${escapeHtml(bet.createdAt || '')}</div>
          </div>
          <div class="bet-meta">
            <span class="pill pill-open">${statusLabel}</span>
            ${meta ? `<span class="pill">${meta}</span>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderHistory() {
  const resolved = state.bets.filter(b => b.status === 'resolved');
  if (!resolved.length) {
    els.historyList.innerHTML =
      '<div class="empty">Resolved rounds will stay here so you can reuse fun questions later.</div>';
    return;
  }

  els.historyList.innerHTML = resolved
    .map(bet => {
      const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
        ? bet.correctAuthors
        : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];

      const winners = (bet.guesses || [])
        .filter(g => correctAuthors.includes(g.guessedAuthorId) && g.wager > 0)
        .map(g => {
          const player = state.players.find(p => p.id === g.playerId);
          return player ? `${player.name} (wagered ${g.wager})` : null;
        })
        .filter(Boolean);

      const metaParts = [];
      if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
      if (bet.land) metaParts.push(escapeHtml(bet.land));
      const metaText = metaParts.length ? metaParts.join(' • ') : '';

      return `
        <article class="history-item">
          <div class="bet-head">
            <div>
              <h3>${escapeHtml(bet.description)}</h3>
              <div class="hint">
                ${metaText ? `${metaText} · ` : ''}
                ${escapeHtml(bet.resolvedAt || '')}
              </div>
            </div>
          </div>

          <div class="hint" style="margin-top:0.4rem;">
            <strong>Winners:</strong>
            ${winners.length ? escapeHtml(winners.join(', ')) : 'No winners'}
          </div>

          <div class="small-actions" style="margin-top:0.5rem;">
            <button
              class="btn btn-secondary"
              type="button"
              onclick="reuseQuestion('${bet.id}')"
            >
              Reuse this question
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderBetPlayers() {
  const guessingBet = getCurrentGuessingBet();
  if (guessingBet) {
    renderGuessingRound(guessingBet);
  } else {
    renderBetRows();
  }
}

function renderSelectedAnswerPanel() {
  if (!els.selectedAnswerPanel) return;

  const bet = getCurrentGuessingBet();

  if (!bet) {
    els.selectedAnswerPanel.innerHTML =
      '<div class="empty">The selected answer and question will appear here once a round reaches guessing.</div>';
    return;
  }

  const chosen = bet.answers.find(a => a.id === bet.chosenAnswerId);
  const answerText = chosen ? chosen.text : '';
  const meta = [bet.attraction, bet.land].filter(Boolean).join(' • ');

  els.selectedAnswerPanel.innerHTML = `
    <div class="stack">
      <div class="field">
        <label>Question</label>
        <div>${escapeHtml(bet.description || 'Unknown question')}</div>
      </div>
      <div class="field">
        <label>Selected answer</label>
        <div>${escapeHtml(answerText || 'No selected answer yet')}</div>
      </div>
      ${
        meta
          ? `
            <div class="field">
              <label>Attraction / Land</label>
              <div class="hint">${escapeHtml(meta)}</div>
            </div>
          `
          : ''
      }
    </div>
  `;
}

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
    .filter(b => b.status === 'resolved' && b.attraction)
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

// Fun fact helper
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

  // If no attraction selected, just use the global pool
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

  // 1) Prefer unused attraction-specific questions
  if (unusedSpecific.length > 0) {
    const idx = Math.floor(Math.random() * unusedSpecific.length);
    return unusedSpecific[idx];
  }

  // 2) Fall back to your global list
  const globalPool = window.DISNEY_LINE_QUESTIONS || [];
  if (!globalPool.length) return '';

  const idx = Math.floor(Math.random() * globalPool.length);
  return globalPool[idx];
}

// Bonus recap
function renderQualifiedBonuses() {
  if (!els.qualifiedBonusPanel) return;

  if (!state.awardedBonuses.length) {
    els.qualifiedBonusPanel.innerHTML =
      '<div class="empty">No bonuses awarded yet.</div>';
    return;
  }

  els.qualifiedBonusPanel.innerHTML = state.awardedBonuses
    .slice(0, 6)
    .map(award => `
      <div class="earned-card">
        <div class="earned-head">
          <div>
            <strong>${escapeHtml(award.playerName)}</strong>
            <div class="hint">${escapeHtml(award.reason)}</div>
          </div>
          <div class="bonus-points">+${award.points}</div>
        </div>
      </div>
    `)
    .join('');
}

// Bonus library
function renderBonusLibrary() {
  if (!els.bonusLibrary) return;
  if (!state.bonuses || !state.bonuses.length) {
    els.bonusLibrary.innerHTML =
      '<div class="empty">No bonus rules defined.</div>';
    return;
  }

  const latest = state.bets.find(b => b.status === 'resolved');
  const latestLand = latest?.land || '';

  els.bonusLibrary.innerHTML = state.bonuses.map(bonus => {
    let qualificationHint = '';

    if (bonus.id === 'noGuessAuthor') {
      qualificationHint = 'Use after a round where nobody guessed correctly.';
    } else if (bonus.id === 'streak3') {
      qualificationHint = 'Use for a player with 3 wins in a row.';
    } else if (bonus.id === 'multiLand') {
      qualificationHint = latestLand
        ? `Use for a player with multiple wins in ${latestLand}.`
        : 'Use for a player with multiple wins in the same land.';
    }

    return `
      <div class="bonus-card">
        <div class="bonus-head">
          <div>
            <h3>${escapeHtml(bonus.name)}</h3>
            <div class="hint">${escapeHtml(bonus.description || '')}</div>
            <div class="hint">${escapeHtml(qualificationHint)}</div>
          </div>
          <div class="bonus-points">+${bonus.points}</div>
        </div>
      </div>
    `;
  }).join('');
}

function render() {
  renderPlayers();
  renderScoreboard();
  renderBetPlayers();
  renderSelectedAnswerPanel();
  renderOpenMetrics();
  renderOpenBets();
  renderHistory();
  renderQualifiedBonuses();
  renderBonusLibrary();
}

// ---------- Reuse question ----------
function reuseQuestion(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  els.attractionName.value = bet.attraction || '';
  els.landName.value = bet.land || '';
  els.betDescription.value = bet.description || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.reuseQuestion = reuseQuestion;

// ---------- Attraction / land prefill ----------
function setupAttractionSuggestions() {
  if (!window.PARKS) return;
  const { attractions } = window.PARKS;

  // 1) Attraction datalist
  const dlAttractions = document.getElementById('attractionSuggestions');
  if (dlAttractions) {
    dlAttractions.innerHTML = attractions
      .map(a => `<option value="${escapeHtml(a.name)}"></option>`)
      .join('');
  }

  // 2) Land datalist (unique land names)
  const dlLands = document.getElementById('landSuggestions');
  if (dlLands) {
    const lands = Array.from(new Set(attractions.map(a => a.land))).sort();
    dlLands.innerHTML = lands
      .map(land => `<option value="${escapeHtml(land)}"></option>`)
      .join('');
  }

  // 3) When attraction changes, auto-fill land
  els.attractionName.addEventListener('input', () => {
    const name = els.attractionName.value.trim().toLowerCase();
    if (!name) return;
    const match = attractions.find(a => a.name.toLowerCase() === name);
    if (match) {
      els.landName.value = match.land;
    }
  });

  els.attractionName.addEventListener('blur', () => {
    if (els.landName.value.trim()) return;
    const name = els.attractionName.value.trim().toLowerCase();
    if (!name) return;
    const match = attractions.find(a => a.name.toLowerCase() === name);
    if (match) {
      els.landName.value = match.land;
    }
  });
}

// ---------- Events ----------
document.getElementById('addPlayerBtn').addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);

  if (!name) return alertLike('Enter a family member name.');
  if (points < 0) return alertLike('Starting points must be 0 or more.');

  addPlayer(name, points);
  els.playerName.value = '';
  els.playerPoints.value = 10;
});

els.playerName.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addPlayerBtn').click();
  }
});

window.addEventListener('load', () => {
  els.playerName.focus();
  loadState();
  render();
  setupAttractionSuggestions();
});

document.getElementById('createBetBtn').addEventListener('click', () => {
  createBet();
});

document.getElementById('randomBetBtn').addEventListener('click', () => {
  const q = getRandomQuestionForAttractionWithFallback();
  if (!q) {
    alertLike('No question ideas are available yet.');
    return;
  }
  els.betDescription.value = q;
});

document.getElementById('clearBetFormBtn').addEventListener('click', () => {
  els.betDescription.value = '';
  els.attractionName.value = '';
  els.landName.value = '';
  renderBetPlayers();
});

document.getElementById('lockGuessesBtn').addEventListener('click', () => {
  const bet = getCurrentGuessingBet();
  if (!bet) {
    alertLike('No round is ready for guessing right now.');
    return;
  }

  const guesses = buildGuessesForBet(bet);
  if (!guesses) return;

  bet.guesses = guesses;
  saveState();
  resolveGuessingBet(bet.id);
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  state.players = [];
  state.bets = [];
  state.pot = 0;
  state.awardedBonuses = [];
  saveState();
  render();
});
