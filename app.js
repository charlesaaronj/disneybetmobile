// Disney Line Guess – app.js

const presetBets = [
  "What do you think will be your favorite moment on this ride?",
  "What 3 words will you say when this ride ends?",
  "What will surprise you most about this ride?",
  "What part of the ride will make you laugh?",
  "What part of the ride will be the scariest?",
  "What is one thing you think you will notice that no one else will?",
  "Describe this ride in 3 silly words you haven't used before."
];

function getRandomPresetBet() {
  if (!presetBets.length) return null;
  const index = Math.floor(Math.random() * presetBets.length);
  return presetBets[index];
}

const state = {
  players: [],
  bets: [],
  pot: 0
};

const els = {
  playerName: document.getElementById('playerName'),
  playerPoints: document.getElementById('playerPoints'),
  playersList: document.getElementById('playersList'),
  scoreboard: document.getElementById('scoreboard'),
  betPlayers: document.getElementById('betPlayers'),
  betDescription: document.getElementById('betDescription'),
  attractionName: document.getElementById('attractionName'),
  landName: document.getElementById('landName'),
  starterHint: document.getElementById('starterHint'),
  openBets: document.getElementById('openBets'),
  historyList: document.getElementById('historyList'),
  openBetMetrics: document.getElementById('openBetMetrics'),
  answerBackdrop: document.getElementById('answerModalBackdrop'),
  answerPrompt: document.getElementById('answerModalPrompt'),
  answerPlayerLabel: document.getElementById('answerModalPlayerLabel'),
  answerInput: document.getElementById('answerModalInput'),
  answerSaveBtn: document.getElementById('answerModalSaveBtn'),
  revealBackdrop: document.getElementById('revealModalBackdrop'),
  revealTitle: document.getElementById('revealModalTitle'),
  revealSub: document.getElementById('revealModalSub'),
  revealBody: document.getElementById('revealModalBody'),
  revealCloseBtn: document.getElementById('revealModalCloseBtn')
};

const STORAGE_KEY = 'disney-line-bet-v1';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clampScore(x) {
  return Math.max(0, Math.round(x));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Could not save state', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;

    state.players = parsed.players;
    state.bets = parsed.bets.map(bet => ({
      ...bet,
      guesses: bet.guesses || [],
      answers: bet.answers || [],
      refunded: !!bet.refunded
    }));
    state.pot = Number(parsed.pot) || 0;
    recalculateScores();
    render();
  } catch (e) {
    console.error('Could not load saved state', e);
  }
}

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
  state.players = state.players.filter(player => player.id !== playerId);
  state.bets = state.bets.filter(
    bet => !bet.guesses?.some(entry => entry.playerId === playerId)
  );
  recalculateScores();
  saveState();
  render();
}

function hasPreviousCorrectInSameLand(playerId, land, currentBetIndex) {
  if (!land) return false;
  for (const bet of state.bets) {
    if (bet.status !== 'resolved') continue;
    if (typeof bet.index !== 'number') continue;
    if (bet.index >= currentBetIndex) continue;
    if (bet.land !== land) continue;

    const correctAuthors = bet.correctAuthors || (bet.correctAuthorId ? [bet.correctAuthorId] : []);
    const correct = bet.guesses?.some(g =>
      g.playerId === playerId &&
      correctAuthors.includes(g.guessedAuthorId) &&
      Number(g.wager) > 0
    );
    if (correct) return true;
  }
  return false;
}

function recalculateScores() {
  // Keep currentPoints as baseline; adjust from there so Hunny Pot gifts stick
  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));
  state.pot = clampScore(state.pot || 0);

  state.bets.forEach(bet => {
    if (bet.status !== 'resolved') return;

    const authorId = bet.correctAuthorId;
    const correctAuthors = bet.correctAuthors || (authorId ? [authorId] : []);
    const guesses = bet.guesses || [];
    const land = bet.land;
    const betIndex = bet.index || 0;

    const wagers = guesses.map(g => ({
      playerId: g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager: Math.max(0, Number(g.wager) || 0)
    }));

    const potThisRound = wagers.reduce((sum, w) => sum + w.wager, 0);
    const winners = wagers.filter(
      w => w.wager > 0 && correctAuthors.includes(w.guessedAuthorId)
    );
    const anyCorrect = winners.length > 0;
    const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

    // Subtract wagers
    wagers.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player || w.wager <= 0) return;
      player.currentPoints = clampScore(player.currentPoints - w.wager);
    });

    // Distribute winnings or send to Hunny Pot
    if (anyCorrect && potThisRound > 0 && totalWinnerWager > 0) {
      winners.forEach(w => {
        const player = playerMap[w.playerId];
        if (!player) return;
        const share = (potThisRound * w.wager) / totalWinnerWager;
        let newPoints = player.currentPoints + share;

        if (hasPreviousCorrectInSameLand(w.playerId, land, betIndex)) {
          newPoints += 1;
        }

        player.currentPoints = clampScore(newPoints);
      });
    } else if (!anyCorrect && potThisRound > 0) {
      state.pot += potThisRound;
    }
  });

  state.players = state.players.map(player => ({
    ...player,
    currentPoints: clampScore(player.currentPoints)
  }));
}

function getAvailablePoints(playerId) {
  const player = state.players.find(p => p.id === playerId);
  return player ? clampScore(player.currentPoints) : 0;
}

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
  bet.answers = bet.answers || [];
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
    saveState();
    hideAnswerModal();
    render();
    startGuessPhase(bet.id);
    return;
  }

  const player = players[currentAnswerIndex];
  els.answerPrompt.textContent = `Hand the phone to ${player.name}. Only they should see this screen.`;
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
  bet.answers = bet.answers || [];
  bet.answers.push({
    id: uid(),
    playerId: player.id,
    text
  });
  saveState();
  currentAnswerIndex += 1;
  nextAnswerPrompt();
});

function createBet() {
  if (!state.players.length) {
    alertLike('Add family members before starting a round.');
    return;
  }

  const attraction = els.attractionName.value.trim();
  const land = els.landName.value.trim();
  let question = els.betDescription.value.trim();

  if (!attraction || !land || !question) {
    alertLike('Attraction, Land, and Question are all required.');
    return;
  }

  const betId = uid();

  const nextIndex = state.bets.length
    ? Math.max(
        0,
        ...state.bets
          .map(b => b.index ?? 0)
      ) + 1
    : 1;

  const newBet = {
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
    refunded: false
  };

  state.bets.unshift(newBet);
  els.betDescription.value = '';
  els.starterHint.textContent = '';
  saveState();
  render();
  startAnswerPhase(betId);
}

function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

function startGuessPhase(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  if (!bet.chosenAnswerId && bet.answers && bet.answers.length) {
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

function renderGuessingRound(bet) {
  if (!bet) {
    els.starterHint.textContent = '';
    renderBetRows();
    return;
  }

  const chosen = bet.answers.find(a => a.id === bet.chosenAnswerId);
  const answerText = chosen ? chosen.text : '';
  const attr = bet.attraction ? `(${bet.attraction}` : '';
  const land = bet.land ? (attr ? ` • ${bet.land})` : `(${bet.land})`) : (attr ? `${attr})` : '');

  els.starterHint.textContent = `Answer to guess ${land ? land + ' ' : ''}${answerText}`;
  renderBetRows();
}

function renderBetRows() {
  if (!state.players.length) {
    els.betPlayers.innerHTML = `<div class="empty">Add players, then start a round.</div>`;
    return;
  }

  const guessingBet = getCurrentGuessingBet();

  els.betPlayers.innerHTML = state.players
    .map(player => {
      const available = getAvailablePoints(player.id);
      return `
        <div class="player-bet-row" data-bet-player-row data-player-id="${player.id}">
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <div class="hint">Available ${available} points</div>
          </div>
          <div class="field">
            <label>Who wrote it?</label>
            <select data-guess-player ${guessingBet ? '' : 'disabled'}>
              ${
                guessingBet
                  ? state.players
                      .map(
                        p =>
                          `<option value="${p.id}">${escapeHtml(p.name)}</option>`
                      )
                      .join('')
                  : ''
              }
            </select>
          </div>
          <div class="field">
            <label>Wager</label>
            <input data-amount type="number" min="0" step="1" value="0" placeholder="0" ${
              guessingBet ? '' : 'disabled'
            } />
          </div>
        </div>
      `;
    })
    .join('');

  attachWagerGuards();
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
    if (wager > available) {
      wager = available;
    }

    return {
      playerId,
      guessedAuthorId,
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
      const player = state.players.find(p => p.id === g.playerId);
      alertLike(
        `${player?.name || 'This player'} only has ${available} available points.`
      );
      return null;
    }
  }

  return guesses;
}

function showRevealModal(title, sub, bodyHtml) {
  els.revealTitle.textContent = title;
  els.revealSub.textContent = sub;
  els.revealBody.innerHTML = bodyHtml;
  els.revealBackdrop.style.display = 'flex';
}

els.revealCloseBtn.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});

function resolveGuessingBet(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  if (!bet.correctAuthorId && (!bet.correctAuthors || !bet.correctAuthors.length)) {
    alertLike('No answer was chosen to guess.');
    return;
  }

  bet.status = 'resolved';
  bet.resolvedAt = new Date().toLocaleString();
  bet.refunded = false;

  const land = bet.land;
  const guesses = bet.guesses || [];
  const correctAuthors = bet.correctAuthors && bet.correctAuthors.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  const wagers = guesses.map(g => ({
    playerId: g.playerId,
    guessedAuthorId: g.guessedAuthorId,
    wager: Math.max(0, Number(g.wager) || 0)
  }));

  const potThisRound = wagers.reduce((sum, w) => sum + w.wager, 0);
  const winners = wagers.filter(
    w => w.wager > 0 && correctAuthors.includes(w.guessedAuthorId)
  );
  const anyCorrect = winners.length > 0;

  const bonusWinners = [];

  if (anyCorrect) {
    const betIndex = bet.index || 0;
    winners.forEach(w => {
      if (hasPreviousCorrectInSameLand(w.playerId, land, betIndex)) {
        const player = state.players.find(p => p.id === w.playerId);
        if (player) bonusWinners.push(player.name);
      }
    });
  }

  recalculateScores();
  saveState();
  render();

  const authorNames = (correctAuthors || [])
    .map(id => {
      const p = state.players.find(pl => pl.id === id);
      return p ? p.name : null;
    })
    .filter(Boolean);

  const winnersList = bet.guesses
    .filter(g => correctAuthors.includes(g.guessedAuthorId) && g.wager > 0)
    .map(g => {
      const player = state.players.find(p => p.id === g.playerId);
      return player ? `${player.name} wagered ${g.wager}` : null;
    })
    .filter(Boolean);

  const metaParts = [];
  if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
  if (bet.land) metaParts.push(escapeHtml(bet.land));

  const bodyParts = [];

  bodyParts.push(`<div class="reveal-section-title">Author${authorNames.length !== 1 ? 's' : ''}</div>`);
  bodyParts.push(`<div>${escapeHtml(authorNames.join(', ') || 'Unknown')}</div>`);

  if (bet.attraction || bet.land) {
    bodyParts.push(
      `<div class="hint">Attraction: ${escapeHtml(bet.attraction || 'Unknown')} ${
        bet.land ? `• ${escapeHtml(bet.land)}` : ''
      }</div>`
    );
  }

  bodyParts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Winners</div>`);

  if (anyCorrect && winnersList.length) {
    bodyParts.push(`<div>${escapeHtml(winnersList.join('<br>'))}</div>`);
  } else if (potThisRound > 0) {
    bodyParts.push(`<div>No one guessed correctly. All wagers went to the Hunny Pot.</div>`);
  } else {
    bodyParts.push(`<div>No one placed a wager this round.</div>`);
  }

  if (bonusWinners.length) {
    const uniqueBonus = [...new Set(bonusWinners)];
    bodyParts.push(
      `<div class="reveal-section-title" style="margin-top:.75rem;">Land streak bonus</div>`
    );
    bodyParts.push(
      `<div>${escapeHtml(uniqueBonus.join(', '))} earned 1 bonus point for a correct guess on the same land.</div>`
    );
  }

  bodyParts.push(
    `<div class="reveal-section-title" style="margin-top:.75rem;">Scores after this round</div>`
  );
  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  bodyParts.push(
    `<div>${ranked
      .map(p => `${escapeHtml(p.name)}: ${clampScore(p.currentPoints)}`)
      .join('<br>')}</div>`
  );
  bodyParts.push(
    `<div class="hint" style="margin-top:.75rem;">Hunny Pot is now ${state.pot} points.</div>`
  );

  showRevealModal(
    'Round result',
    'Here is who wrote the answer and how the points changed.',
    bodyParts.join('')
  );
}

function cloneBet(betId) {
  const bet = state.bets.find(item => item.id === betId);
  if (!bet) return;
  els.betDescription.value = bet.description || '';
  els.attractionName.value = bet.attraction || '';
  els.landName.value = bet.land || '';
  renderBetRows();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteBet(betId) {
  state.bets = state.bets.filter(bet => bet.id !== betId);
  recalculateScores();
  saveState();
  render();
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
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'var(--color-text)',
    color: 'var(--color-text-inverse)',
    boxShadow: 'var(--shadow-md)',
    maxWidth: 'calc(100vw - 32px)'
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function renderPlayers() {
  if (!state.players.length) {
    els.playersList.innerHTML =
      '<div class="empty">No family members yet. Add names above to begin.</div>';
    return;
  }

  const potHtml = `
    <div class="player-chip" style="margin-bottom:.5rem;">
      <div>
        <strong>Hunny Pot</strong>
        <div class="hint">Extra points you can give back to players.</div>
      </div>
      <div>
        <span class="pill pot-pill">Hunny Pot ${state.pot}</span>
        <div class="small-actions" style="margin-top:.25rem;">
          <button class="btn btn-secondary" type="button" onclick="addToPot()">Add to Hunny Pot</button>
          <button class="btn btn-danger" type="button" onclick="clearPot()">Clear Hunny Pot</button>
        </div>
      </div>
    </div>
  `;

  const playersHtml = state.players
    .map(player => {
      return `
        <div class="player-chip">
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <div class="hint">Starts with ${player.startingPoints} points</div>
          </div>
          <div>
            <div class="small-actions">
              <span class="pill pill-open">${clampScore(player.currentPoints)} now</span>
              ${
                clampScore(player.currentPoints) === 0 && state.pot > 0
                  ? `<button class="btn btn-secondary" type="button" onclick="giveFromPot('${player.id}')">Give from Hunny Pot</button>`
                  : ''
              }
              <button class="btn btn-danger" type="button" onclick="removePlayer('${player.id}')">Remove</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  els.playersList.innerHTML = potHtml + playersHtml;
}

function renderScoreboard() {
  if (!state.players.length) {
    els.scoreboard.innerHTML =
      '<div class="empty">Scores will appear here once players are added.</div>';
    return;
  }

  const ranked = [...state.players].sort(
    (a, b) => b.currentPoints - a.currentPoints
  );

  els.scoreboard.innerHTML = ranked
    .map((player, index) => {
      return `
        <div class="score-card">
          <div class="muted">${index === 0 ? 'Leader' : `Place ${index + 1}`}</div>
          <div class="score-name">${escapeHtml(player.name)}</div>
          <div class="score-points">${clampScore(player.currentPoints)}</div>
          <div class="hint">Started with ${player.startingPoints}</div>
        </div>
      `;
    })
    .join('');
}

function renderBetPlayers() {
  const guessingBet = getCurrentGuessingBet();
  if (guessingBet) {
    renderGuessingRound(guessingBet);
  } else {
    els.starterHint.textContent = '';
    renderBetRows();
  }
}

function renderOpenMetrics() {
  const answering = state.bets.filter(bet => bet.status === 'answering').length;
  const guessing = state.bets.filter(bet => bet.status === 'guessing').length;
  const resolved = state.bets.filter(bet => bet.status === 'resolved').length;

  els.openBetMetrics.innerHTML = `
    <div class="metric">
      <span class="muted">Answering rounds</span>
      <span class="metric-value">${answering}</span>
    </div>
    <div class="metric">
      <span class="muted">Guessing rounds</span>
      <span class="metric-value">${guessing}</span>
    </div>
    <div class="metric">
      <span class="muted">Resolved rounds</span>
      <span class="metric-value">${resolved}</span>
    </div>
    <div class="metric">
      <span class="muted">Hunny Pot</span>
      <span class="metric-value">${state.pot}</span>
    </div>
  `;
}

function renderOpenBets() {
  const nonResolved = state.bets.filter(bet => bet.status !== 'resolved');
  if (!nonResolved.length) {
    els.openBets.innerHTML =
      '<div class="empty">No active rounds. Start a new question above.</div>';
    return;
  }

  els.openBets.innerHTML = nonResolved
    .map(bet => {
      const statusLabel =
        bet.status === 'answering'
          ? 'Collecting answers'
          : bet.status === 'guessing'
          ? 'Guessing & wagering'
          : 'Round';

      const metaParts = [];
      if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
      if (bet.land) metaParts.push(escapeHtml(bet.land));
      const metaText = metaParts.length ? metaParts.join(' • ') : '';

      return `
        <article class="bet-card">
          <div class="bet-head">
            <div>
              <h3>${escapeHtml(bet.description)}</h3>
              <div class="hint">Created ${escapeHtml(bet.createdAt || '')}</div>
            </div>
            <div class="bet-meta">
              <span class="pill pill-open">${statusLabel}</span>
              ${metaText ? `<span class="pill">${metaText}</span>` : ''}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderHistory() {
  const resolved = state.bets.filter(bet => bet.status === 'resolved');
  if (!resolved.length) {
    els.historyList.innerHTML =
      '<div class="empty">Resolved rounds will stay here so you can reuse fun questions later.</div>';
    return;
  }

  els.historyList.innerHTML = resolved
    .map(bet => {
      const correctAuthors = bet.correctAuthors && bet.correctAuthors.length
        ? bet.correctAuthors
        : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

      const authorNames = correctAuthors
        .map(id => {
          const p = state.players.find(pl => pl.id === id);
          return p ? p.name : null;
        })
        .filter(Boolean);

      const winners = (bet.guesses || [])
        .filter(g => correctAuthors.includes(g.guessedAuthorId) && g.wager > 0)
        .map(g => {
          const player = state.players.find(p => p.id === g.playerId);
          return player ? `${player.name} wagered ${g.wager}` : null;
        })
        .filter(Boolean);

      const metaParts = [];
      if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
      if (bet.land) metaParts.push(escapeHtml(bet.land));

      return `
        <article class="history-item">
          <div class="bet-head">
            <div>
              <h3>${escapeHtml(bet.description)}</h3>
              <div class="hint">Resolved ${escapeHtml(bet.resolvedAt || '')}</div>
            </div>
            <div class="bet-meta">
              <span class="pill pill-won">Round finished</span>
              ${
                authorNames.length
                  ? `<span class="pill">Author: ${escapeHtml(authorNames.join(', '))}</span>`
                  : ''
              }
              ${metaParts.length ? `<span class="pill">${metaParts.join(' • ')}</span>` : ''}
            </div>
          </div>
          <div class="hint">
            Winners … ${
              winners.length ? escapeHtml(winners.join(', ')) : 'No winners'
            }
          </div>
          <div class="small-actions" style="margin-top:.75rem;">
            <button class="btn btn-secondary" type="button" onclick="cloneBet('${bet.id}')">Reuse question</button>
            <button class="btn btn-danger" type="button" onclick="deleteBet('${bet.id}')">Delete</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function attachWagerGuards() {
  const rows = [...document.querySelectorAll('[data-bet-player-row]')];
  rows.forEach(row => {
    const playerId = row.dataset.playerId;
    const input = row.querySelector('[data-amount]');
    if (!input) return;

    const handler = () => {
      const available = getAvailablePoints(playerId);
      let value = Number(input.value) || 0;
      if (!Number.isFinite(value) || value < 0) value = 0;
      if (value > available) {
        value = available;
        alertLike(`That's the max they can wager this round (${available} points).`);
      }
      input.value = value;
    };

    input.addEventListener('change', handler, { once: true });
  });
}

function render() {
  renderPlayers();
  renderScoreboard();
  renderBetPlayers();
  renderOpenMetrics();
  renderOpenBets();
  renderHistory();
  attachWagerGuards();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function giveFromPot(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  if (state.pot <= 0) {
    alertLike('No points in the Hunny Pot right now.');
    return;
  }
  const max = state.pot;
  const amountStr = prompt(
    `How many points do you want to give to ${player.name} from the Hunny Pot? (Max ${max})`,
    String(Math.min(3, max))
  );
  if (amountStr === null) return;
  let amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (amount > max) amount = max;
  state.pot -= amount;
  player.currentPoints = clampScore(player.currentPoints + amount);
  saveState();
  render();
}

function addToPot() {
  const current = state.pot;
  const input = prompt(
    `How many points do you want to add to the Hunny Pot? (Current: ${current})`,
    '5'
  );
  if (input === null) return;
  let amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) {
    alertLike('Enter a number greater than 0.');
    return;
  }
  state.pot += amount;
  saveState();
  render();
}

function clearPot() {
  if (!state.pot) return;
  const confirmClear = confirm(`Clear the Hunny Pot (${state.pot} points)?`);
  if (!confirmClear) return;
  state.pot = 0;
  saveState();
  render();
}

window.removePlayer = removePlayer;
window.cloneBet = cloneBet;
window.deleteBet = deleteBet;
window.giveFromPot = giveFromPot;
window.addToPot = addToPot;
window.clearPot = clearPot;

document.getElementById('addPlayerBtn').addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);
  if (!name) return alertLike('Enter a family member name.');
  if (points < 0) return alertLike('Starting points must be 0 or more.');
  addPlayer(name, points);
  els.playerName.value = '';
  els.playerPoints.value = 10;
});

const playerNameInput = els.playerName;
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addPlayerBtn').click();
  }
});

window.addEventListener('load', () => {
  playerNameInput.focus();
  loadState();
});

document.getElementById('createBetBtn').addEventListener('click', createBet);

document.getElementById('randomBetBtn').addEventListener('click', () => {
  const idea = getRandomPresetBet();
  if (!idea) return;
  els.betDescription.value = idea;
});

document.getElementById('clearBetFormBtn').addEventListener('click', () => {
  els.betDescription.value = '';
  els.attractionName.value = '';
  els.landName.value = '';
  els.starterHint.textContent = '';
  renderBetPlayers();
  attachWagerGuards();
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
  saveState();
  render();
});

document.getElementById('resetDemoBtn').addEventListener('click', () => {
  function ensurePlayer(name) {
    let player = state.players.find(p => p.name === name);
    if (!player) {
      addPlayer(name, 10);
      player = state.players.find(p => p.name === name);
    }
    return player;
  }

  const mom = ensurePlayer('Mom');
  const dad = ensurePlayer('Dad');
  const ava = ensurePlayer('Ava');
  const liam = ensurePlayer('Liam');

  const demoId = uid();
  const nextIndex = state.bets.length
    ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
    : 1;

  state.bets.unshift({
    id: demoId,
    index: nextIndex,
    description: 'What do you think will be your favorite moment on this ride?',
    createdAt: new Date().toLocaleString(),
    attraction: 'Test Ride',
    land: 'Tomorrowland',
    status: 'resolved',
    answers: [
      { id: uid(), playerId: mom.id, text: 'The big drop' },
      { id: uid(), playerId: dad.id, text: 'The animatronics' },
      { id: uid(), playerId: ava.id, text: 'The music' },
      { id: uid(), playerId: liam.id, text: 'The queue theming' }
    ],
    chosenAnswerId: null,
    correctAuthorId: mom.id,
    correctAuthors: [mom.id],
    guesses: [
      { playerId: mom.id, guessedAuthorId: mom.id, wager: 2 },
      { playerId: dad.id, guessedAuthorId: mom.id, wager: 1 },
      { playerId: ava.id, guessedAuthorId: dad.id, wager: 1 },
      { playerId: liam.id, guessedAuthorId: ava.id, wager: 1 }
    ],
    refunded: false,
    resolvedAt: new Date().toLocaleString()
  });

  recalculateScores();
  saveState();
  render();
});

// Theme toggle
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
});
