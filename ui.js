// ui.js
// All DOM wiring, rendering, and event handlers live here.
// This is the only file loaded by the HTML via <script type="module">;
// it imports state + game-logic, and triggers re-renders when needed.

import {
  state,
  loadState,
  saveState,
  enforceMinPot,
  clampScore,
  escapeHtml,
  alertLike,
  getAvailablePoints
} from './game-state.js';

import {
  addPlayer,
  removePlayer,
  giveFromPot,
  addToPot,
  clearPot,
  getCurrentGuessingBet,
  finalizeCreateBet,
  startAnswerPhase,
  getNextAnswerPrompt,
  savePlayerAnswer,
  startGuessPhase,
  normalizeGuesses,
  awardBonus,
  getRandomUnusedGlobalQuestion,
  resolveGuessingBet,
  getRandomQuestionForAttractionWithFallback,
  rerollCurrentSelectedAnswer
} from './game-logic.js';

// ---------- DOM element lookups ----------

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
  answerGhostBtn: document.getElementById('answerModalGhostBtn'),

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

  // Hot Round modal
  hotRoundBackdrop: document.getElementById('hotRoundModalBackdrop'),
  hotRoundMessage: document.getElementById('hotRoundModalMessage'),
  hotRoundInput: document.getElementById('hotRoundModalInput'),
  hotRoundCancel: document.getElementById('hotRoundModalCancel'),
  hotRoundSkip: document.getElementById('hotRoundModalSkip'),
  hotRoundConfirm: document.getElementById('hotRoundModalConfirm'),

  qualifiedBonusPanel: document.getElementById('qualifiedBonusPanel'),
  bonusLibrary: document.getElementById('bonusLibrary'),

  scoreboardScoresScreen: document.getElementById('scoreboardScoresScreen'),
  qualifiedBonusPanelScores: document.getElementById('qualifiedBonusPanelScores'),

  revealSummary: document.getElementById('revealSummary')
};

// ---------- Screen elements / navigation ----------

const screenIds = ['setup', 'question', 'wager', 'reveal', 'scores', 'history'];
const screens = {};
screenIds.forEach(id => {
  screens[id] = document.getElementById(`screen-${id}`);
});

const navEls = {
  startGameBtn: document.getElementById('startGameBtn'),
  toScoresBtn: document.getElementById('toScoresBtn'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  viewHistoryBtn: document.getElementById('viewHistoryBtn'),
  backToScoresBtn: document.getElementById('backToScoresBtn'),
  restartGameBtn: document.getElementById('restartGameBtn')
};

// Switch which “screen” is visible.
function showScreen(id) {
  screenIds.forEach(name => {
    const el = screens[name];
    if (!el) return;
    el.classList.toggle('screen--active', name === id);
  });
}

function goToSetup() {
  showScreen('setup');
}

function goToQuestion() {
  showScreen('question');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToWager() {
  showScreen('wager');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToReveal() {
  showScreen('reveal');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToScores() {
  showScreen('scores');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToHistory() {
  showScreen('history');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Helpers to reset the new-round form.
function resetQuestionForm() {
  els.attractionName.value = '';
  els.landName.value = '';
  els.betDescription.value = '';
}

// ---------- Hunny Pot modal wrappers (UI) ----------

// Open “give from pot” modal and delegate to game-logic.
function openGiveFromPotModal(playerId) {
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
    const amount = Number(els.giveHunnyInput.value);
    giveFromPot(playerId, amount);
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

// Open “add to pot” modal and delegate to game-logic.
function openAddToPotModal() {
  els.addHunnyInput.value = '5';
  els.addHunnyInput.min = '1';

  const close = () => {
    els.addHunnyBackdrop.style.display = 'none';
    els.addHunnyConfirm.removeEventListener('click', onConfirm);
    els.addHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    const amount = Number(els.addHunnyInput.value);
    addToPot(amount);
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

// Open “clear pot” confirmation modal.
function openClearPotModal() {
  if (!state.pot) return;

  els.clearHunnyMessage.textContent =
    `Clear the Hunny Pot (${state.pot} points)?`;

  const close = () => {
    els.clearHunnyBackdrop.style.display = 'none';
    els.clearHunnyConfirm.removeEventListener('click', onConfirm);
    els.clearHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    clearPot();
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

// Expose these to inline HTML onclicks if you want to keep that pattern.
window.addToPot = openAddToPotModal;
window.clearPot = openClearPotModal;
window.giveFromPot = openGiveFromPotModal;
window.removePlayer = removePlayer;
window.awardBonus = awardBonus;
window.rerollCurrentSelectedAnswer = () => {
  rerollCurrentSelectedAnswer();
  render();
};

// ---------- Hot Round modal (UI) ----------

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

// ---------- Answer collection UI ----------

let currentAnswerBetId = null;
let currentAnswerIndex = 0;

function showAnswerModal() {
  els.answerBackdrop.style.display = 'flex';
}

function hideAnswerModal() {
  els.answerBackdrop.style.display = 'none';
}

// Start answer phase for a bet and immediately prompt the first player.
function startAnswerPhaseUI(betId) {
  const bet = startAnswerPhase(betId);
  if (!bet) return;
  currentAnswerBetId = betId;
  currentAnswerIndex = 0;
  nextAnswerPromptUI();
}

// Ask the next player for an answer, or move the round into guessing.
function nextAnswerPromptUI() {
  const { done, bet, player, nextIndex } = getNextAnswerPrompt(
    currentAnswerBetId,
    currentAnswerIndex
  );
  if (!bet) return;

  if (done) {
    hideAnswerModal();
    render();
    goToWager();
    return;
  }

  currentAnswerIndex = nextIndex;

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

// Save a typed-in answer and continue to next player.
function saveAnswerUI(useGhost = false) {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const text = useGhost
    ? (typeof window.getRandomRideFragment === 'function'
        ? window.getRandomRideFragment()
        : '')
    : els.answerInput.value.trim();

  if (!text) {
    alertLike(useGhost
      ? 'No ride fragments are available right now.'
      : 'Type an answer before saving.');
    return;
  }

  const { nextIndex } = savePlayerAnswer(
    currentAnswerBetId,
    currentAnswerIndex,
    text,
    useGhost
  );
  currentAnswerIndex = nextIndex;
  nextAnswerPromptUI();
}

if (els.answerSaveBtn) {
  els.answerSaveBtn.addEventListener('click', () => saveAnswerUI(false));
}

if (els.answerCancelBtn) {
  els.answerCancelBtn.addEventListener('click', () => {
    hideAnswerModal();
  });
}

if (els.answerGhostBtn) {
  els.answerGhostBtn.addEventListener('click', () => saveAnswerUI(true));
}

// ---------- Guessing & wagering UI ----------

function renderGuessingRound() {
  renderBetRows();
}

// Render the “wager per player” list for the current guessing bet.
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
          <input data-amount type="number" min="0" step="1" value="1"
            placeholder="1" inputmode="numeric" pattern="[0-9]*"
            ${guessingBet ? '' : 'disabled'} />
        </div>
      </div>
    `;
  }).join('');

  attachWagerGuards();
}

// Limit wagers to each player’s available points.
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

// Read guesses from DOM and convert into raw guesses for the logic layer.
function buildRawGuessesForBet() {
  const rows = [...document.querySelectorAll('[data-bet-player-row]')];
  return rows.map(row => {
    const playerId = row.dataset.playerId;
    const select = row.querySelector('[data-guess-player]');
    const input = row.querySelector('[data-amount]');
    const guessedAuthorId = select ? select.value : null;
    const wager = Number(input ? input.value : 0) || 0;
    return { playerId, guessedAuthorId, wager };
  });
}

// ---------- Rendering helpers ----------

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
    const empty = '<div class="empty">Scores will appear here once players are added.</div>';
    els.scoreboard.innerHTML = empty;
    if (els.scoreboardScoresScreen) {
      els.scoreboardScoresScreen.innerHTML = empty;
    }
    return;
  }

  const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  const cardsHtml = ranked.map((p, i) => `
    <div class="score-card">
      <div class="hint">${i === 0 ? 'Leader' : 'Place ' + (i + 1)}</div>
      <div class="score-name">${escapeHtml(p.name)}</div>
      <div class="score-points">${clampScore(p.currentPoints)}</div>
      <div class="hint">Started with ${p.startingPoints}</div>
    </div>
  `).join('');

  els.scoreboard.innerHTML = cardsHtml;
  if (els.scoreboardScoresScreen) {
    els.scoreboardScoresScreen.innerHTML = cardsHtml;
  }
}

function renderQualifiedBonuses() {
  if (!els.qualifiedBonusPanel) return;

  if (!state.awardedBonuses.length) {
    els.qualifiedBonusPanel.innerHTML =
      '<div class="empty">No bonuses awarded yet.</div>';
    if (els.qualifiedBonusPanelScores) {
      els.qualifiedBonusPanelScores.innerHTML =
        '<div class="empty">No bonuses awarded yet.</div>';
    }
    return;
  }

  const html = state.awardedBonuses
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

  els.qualifiedBonusPanel.innerHTML = html;
  if (els.qualifiedBonusPanelScores) {
    els.qualifiedBonusPanelScores.innerHTML = html;
  }
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

    const hot = bet.hotRound && bet.hotRoundBonus > 0
      ? `<span class="pill">Hot Round +${bet.hotRoundBonus}</span>`
      : '';

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
            ${hot}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderHistory() {
  const resolved = state.bets.filter(b => b.status === 'resolved');

  const playerGiveHtml = state.players.length
    ? state.players.map(p => `
        <div class="player-chip" style="margin-top:.5rem;">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <div class="hint">${clampScore(p.currentPoints)} points right now</div>
          </div>
          <div class="small-actions">
            <button
              class="btn btn-secondary"
              type="button"
              onclick="giveFromPot('${p.id}')"
              ${state.pot > 0 ? '' : 'disabled'}
            >
              Give from Hunny Pot
            </button>
          </div>
        </div>
      `).join('')
    : '<div class="empty">No players yet.</div>';

  const potControls = `
    <article class="history-item" style="margin-bottom:.75rem;">
      <div class="bet-head">
        <div>
          <h3>Hunny Pot</h3>
          <div class="hint">Change the Hunny Pot and give points between questions here.</div>
        </div>
      </div>
      <div class="small-actions-hunny" style="margin-top:.5rem;">
        <span class="pill pot-pill-total">Hunny Pot ${state.pot}</span>
        <button class="btn btn-secondary" type="button" onclick="addToPot()">Add Pts</button>
        <button class="btn btn-danger" type="button" onclick="clearPot()">Clear</button>
      </div>
      <div class="stack" style="margin-top:.75rem;">
        ${playerGiveHtml}
      </div>
    </article>
  `;

  if (!resolved.length) {
    els.historyList.innerHTML =
      potControls +
      '<div class="empty">Resolved rounds will stay here so you can reuse fun questions later.</div>';
    return;
  }

  const historyHtml = resolved
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

      const hot = bet.hotRound && bet.hotRoundBonus > 0
        ? `<div class="hint" style="margin-top:.35rem;"><strong>Hot Round:</strong> +${bet.hotRoundBonus} Hunny Pot bonus</div>`
        : '';

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
          ${hot}

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

  els.historyList.innerHTML = potControls + historyHtml;
}

// Render the guessing panel; pick round-specific or generic view.
function renderBetPlayers() {
  const guessingBet = getCurrentGuessingBet();
  if (guessingBet) {
    renderGuessingRound(guessingBet);
  } else {
    renderBetRows();
  }
}

// Show the currently selected answer / meta in the side panel.
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
  const canReroll = Array.isArray(bet.answers) && bet.answers.length > 1;

  const hot = bet.hotRound && bet.hotRoundBonus > 0
    ? `
      <div class="field">
        <div class="hint">+${bet.hotRoundBonus} from the Hunny Pot</div>
      </div>
    `
    : '';

  els.selectedAnswerPanel.innerHTML = `
    <div class="stack">
      <div class="field">
        <label>Question</label>
        <div class="hint">${escapeHtml(bet.description || 'Unknown question')}</div>
      </div>
      <div class="field">
        <label>Selected answer</label>
        <div class="hint">${escapeHtml(answerText || 'No selected answer yet')}</div>
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
      ${hot}
      ${
        canReroll
          ? `
            <div class="small-actions" style="margin-top:.5rem;">
              <button class="btn btn-secondary" type="button" onclick="rerollCurrentSelectedAnswer()">
               Select new answer
              </button>
            </div>
          `
          : ''
      }
    </div>
  `;
}

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

// Central render that updates all panels / screens.
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

// ---------- Reuse question helper ----------

function reuseQuestion(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;

  els.attractionName.value = bet.attraction || '';
  els.landName.value = bet.land || '';
  els.betDescription.value = bet.description || '';

  goToQuestion();
}
window.reuseQuestion = reuseQuestion;

// ---------- Attraction / land prefill UI ----------

function setupAttractionSuggestions() {
  if (!window.PARKS) return;
  const attractions = window.PARKS.attractions || [];

  const dlAttractions = document.getElementById('attractionSuggestions');
  if (dlAttractions) {
    dlAttractions.innerHTML = attractions
      .map(a => `<option value="${escapeHtml(a.name)}"></option>`)
      .join('');
  }

  const dlLands = document.getElementById('landSuggestions');
  if (dlLands) {
    const lands = Array.from(new Set(attractions.map(a => a.land))).sort();
    dlLands.innerHTML = lands
      .map(land => `<option value="${escapeHtml(land)}"></option>`)
      .join('');
  }

  function applyAttractionSelection() {
    const name = els.attractionName.value.trim().toLowerCase();
    if (!name) return;

    const match = attractions.find(a => a.name.toLowerCase() === name);
    if (!match) return;

    if (match.land) {
      els.landName.value = match.land;
    }

    if (!els.betDescription.value.trim()) {
      const question = getRandomQuestionForAttractionWithFallback(match.name);
      if (question) {
        els.betDescription.value = question;
      }
    }
  }

  els.attractionName?.addEventListener('input', applyAttractionSelection);
  els.attractionName?.addEventListener('change', applyAttractionSelection);
  els.attractionName?.addEventListener('blur', applyAttractionSelection);
}

// ---------- Events ----------

document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);

  if (!name) return alertLike('Enter a family member name.');
  if (points < 0) return alertLike('Starting points must be 0 or more.');

  addPlayer(name, points);
  render();

  els.playerName.value = '';
  els.playerPoints.value = 10;
});

els.playerName?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addPlayerBtn')?.click();
  }
});

// Set up create-bet + random-question buttons.
document.getElementById('createBetBtn')?.addEventListener('click', () => {
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

  // If pot is healthy, offer Hot Round; otherwise create immediately.
  if (state.pot > 10) {
    openHotRoundModal(selection => {
      if (!selection) return;
      const bet = finalizeCreateBet({
        attraction,
        land,
        question,
        hotRound: selection.hotRound,
        hotRoundBonus: selection.hotRoundBonus
      });
      if (!bet) return;
      render();
      startAnswerPhaseUI(bet.id);
    });
  } else {
    const bet = finalizeCreateBet({
      attraction,
      land,
      question,
      hotRound: false,
      hotRoundBonus: 0
    });
    if (!bet) return;
    render();
    startAnswerPhaseUI(bet.id);
  }
});

document.getElementById('randomBetBtn')?.addEventListener('click', () => {
  const q = getRandomUnusedGlobalQuestion();
  if (!q) {
    alertLike('No global question ideas are available yet.');
    return;
  }
  els.betDescription.value = q;
});

document.getElementById('clearBetFormBtn')?.addEventListener('click', () => {
  resetQuestionForm();
  renderBetPlayers();
});

// Lock guesses, resolve round, and show reveal screen.
document.getElementById('lockGuessesBtn')?.addEventListener('click', () => {
  const bet = getCurrentGuessingBet();
  if (!bet) {
    alertLike('No round is ready for guessing right now.');
    return;
  }

  const rawGuesses = buildRawGuessesForBet();
  const guesses = normalizeGuesses(rawGuesses);
  if (!guesses) return;

  bet.guesses = guesses;
  saveState();

  const result = resolveGuessingBet(bet.id);
  if (!result) return;

  if (els.revealSummary) {
    els.revealSummary.innerHTML = result.html;
  }

  els.revealTitle.textContent = 'Round result';
  els.revealSub.textContent = 'Here is who said the answer and how the points changed.';
  els.revealBody.innerHTML = result.html;
  els.revealBackdrop.style.display = 'none';

  render();
  goToReveal();
});

// Global clear-all (players, bets, pot).
document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  state.players = [];
  state.bets = [];
  state.pot = 0;
  state.awardedBonuses = [];
  saveState();
  render();
  goToSetup();
});

// Nav buttons
navEls.startGameBtn?.addEventListener('click', () => {
  if (state.players.length < 2) {
    alertLike('Add at least two family members first.');
    return;
  }
  resetQuestionForm();
  goToQuestion();
});

navEls.toScoresBtn?.addEventListener('click', () => {
  goToScores();
});

navEls.nextRoundBtn?.addEventListener('click', () => {
  resetQuestionForm();
  goToQuestion();
});

navEls.viewHistoryBtn?.addEventListener('click', () => {
  renderHistory();
  goToHistory();
});

navEls.backToScoresBtn?.addEventListener('click', () => {
  goToScores();
});

navEls.restartGameBtn?.addEventListener('click', () => {
  goToSetup();
});

// Reveal modal close behavior
els.revealCloseBtn?.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});

els.revealBackdrop?.addEventListener('click', event => {
  if (event.target === els.revealBackdrop) {
    els.revealBackdrop.style.display = 'none';
  }
});

// ---------- Bootstrapping ----------

window.addEventListener('load', () => {
  loadState();
  enforceMinPot();
  render();
  setupAttractionSuggestions();
  goToSetup();
  els.playerName?.focus();
});
