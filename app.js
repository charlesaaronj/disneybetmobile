// === Minimal Disney Line Guess logic with stable Hunny Pot ===
// ---------- State ----------
const state = {
  players: [],
  bets: [],
  pot: 0
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
  revealCloseBtn: document.getElementById('revealModalCloseBtn'),

  // Add-to-Hunny modal
  addHunnyBackdrop: document.getElementById('addHunnyModalBackdrop'),
  addHunnyInput: document.getElementById('addHunnyModalInput'),
  addHunnyCancel: document.getElementById('addHunnyModalCancel'),
  addHunnyConfirm: document.getElementById('addHunnyModalConfirm'),

  // Give-from-Hunny modal
  giveHunnyBackdrop: document.getElementById('giveHunnyModalBackdrop'),
  giveHunnyMessage: document.getElementById('giveHunnyModalMessage'),
  giveHunnyInput: document.getElementById('giveHunnyModalInput'),
  giveHunnyCancel: document.getElementById('giveHunnyModalCancel'),
  giveHunnyConfirm: document.getElementById('giveHunnyModalConfirm'),

  // Clear Hunny Pot modal
  clearHunnyBackdrop: document.getElementById('clearHunnyModalBackdrop'),
  clearHunnyMessage: document.getElementById('clearHunnyModalMessage'),
  clearHunnyCancel: document.getElementById('clearHunnyModalCancel'),
  clearHunnyConfirm: document.getElementById('clearHunnyModalConfirm')
    
  selectedAnswerPanel: document.getElementById('selectedAnswerPanel')
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
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
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
  } catch {}
}

function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
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

// ---------- Hunny Pot (only touches pot + currentPoints) ----------
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
  String(max)
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

  // Setup modal text
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

// expose for onclick
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
    guesses: []
  };

  state.bets.unshift(bet);
  els.betDescription.value = '';
  els.starterHint.textContent = '';
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
    saveState();
    hideAnswerModal();
    render();
    startGuessPhase(bet.id);
    return;
  }
    const player = players[currentAnswerIndex];

  const metaParts = [];
  if (bet.attraction) metaParts.push(bet.attraction);
  if (bet.land) metaParts.push(bet.land);
  const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}. Only they should see this screen.\n\n` +
    `Question: ${bet.description} ${meta}`;

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

function renderGuessingRound(bet) {
  if (!bet) {
    els.starterHint.textContent = '';
    renderBetRows();
    return;
  }
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
    input.addEventListener('change', () => {
      const available = getAvailablePoints(playerId);
      let value = Number(input.value) || 0;
      if (!Number.isFinite(value) || value < 0) value = 0;
      if (value > available) {
        value = available;
        alertLike(`That's the max they can wager this round (${available} points).`);
      }
      input.value = value;
    }, { once: true });
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

// ---------- Resolve one round (ONLY place where wagers affect scores) ----------
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

  // Apply this round ON TOP of current points
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

  bet.status = 'resolved';
  bet.resolvedAt = new Date().toLocaleString();
  saveState();
  render();

  // Reveal modal text
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

  els.revealTitle.textContent = 'Round result';
  els.revealSub.textContent = 'Here is who said the answer and how the points changed.';
  els.revealBody.innerHTML = parts.join('');
  els.revealBackdrop.style.display = 'flex';
}

els.revealCloseBtn.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
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
      ${
        winners.length
          ? escapeHtml(winners.join(', '))
          : 'No winners'
      }
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
    els.starterHint.textContent = '';
    renderBetRows();
  }
}

function render() {
  renderPlayers();
  renderScoreboard();
  renderBetPlayers();
  renderSelectedAnswerPanel();
  renderOpenMetrics();
  renderOpenBets();
  renderHistory();
}

function renderSelectedAnswerPanel() {
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
});

document.getElementById('createBetBtn').addEventListener('click', createBet);

document.getElementById('randomBetBtn').addEventListener('click', () => {
  const ideas = window.DISNEY_LINE_QUESTIONS || [];
  if (!ideas.length) return;
  const idx = Math.floor(Math.random() * ideas.length);
  els.betDescription.value = ideas[idx];
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
