// ============================================================
// ui-render.js
// Who Said Diz — pure rendering helpers and cached element lookups.
//
// Rules for this file:
//   - NO game logic (no point math, no state decisions).
//   - Reads from state and formats DOM only.
//   - All mutations of state happen in game-logic-rounds.js.
// ============================================================

import {
  state,
  clampScore,
  escapeHtml,
  getAvailablePoints
} from './game-state.js';

import {
  getCurrentGuessingBet
} from './game-logic-rounds.js';


// ============================================================
// ELEMENT CACHE
// ============================================================

export const els = {
  // Setup
  playerName:       document.getElementById('playerName'),
  playerPoints:     document.getElementById('playerPoints'),
  playersList:      document.getElementById('playersList'),

  // Question
  attractionName:   document.getElementById('attractionName'),
  landName:         document.getElementById('landName'),
  betDescription:   document.getElementById('betDescription'),

  // Wager
  wagerTableBody:   document.getElementById('wagerTableBody'),
  wagerHints:       document.getElementById('wagerHints'),

  // Reveal
  revealBackdrop:   document.getElementById('revealBackdrop'),
  revealContent:    document.getElementById('revealContent'),
  revealCloseBtn:   document.getElementById('revealCloseBtn'),
  selectedAnswerPanel: document.getElementById('selectedAnswerPanel'),

  // Scores & history
  scoresTableBody:  document.getElementById('scoresTableBody'),
  hunnyPotLabel:    document.getElementById('hunnyPotLabel'),
  historyList:      document.getElementById('historyList'),

  // Theme
  themeToggleBtn:   document.getElementById('themeToggleBtn'),

  // Answer modal
  answerBackdrop:   document.getElementById('answerBackdrop'),
  answerPrompt:     document.getElementById('answerPrompt'),
  answerPlayerLabel:document.getElementById('answerPlayerLabel'),
  answerInput:      document.getElementById('answerInput'),
  answerSaveBtn:    document.getElementById('answerSaveBtn'),
  answerCancelBtn:  document.getElementById('answerCancelBtn'),
  answerGhostBtn:   document.getElementById('answerGhostBtn'),

  // Hunny Pot modals
  giveHunnyBackdrop: document.getElementById('giveHunnyBackdrop'),
  giveHunnyMessage:  document.getElementById('giveHunnyMessage'),
  giveHunnyInput:    document.getElementById('giveHunnyInput'),
  giveHunnyConfirm:  document.getElementById('giveHunnyConfirm'),
  giveHunnyCancel:   document.getElementById('giveHunnyCancel'),

  addHunnyBackdrop:  document.getElementById('addHunnyBackdrop'),
  addHunnyInput:     document.getElementById('addHunnyInput'),
  addHunnyConfirm:   document.getElementById('addHunnyConfirm'),
  addHunnyCancel:    document.getElementById('addHunnyCancel'),

  clearHunnyBackdrop: document.getElementById('clearHunnyBackdrop'),
  clearHunnyMessage:  document.getElementById('clearHunnyMessage'),
  clearHunnyConfirm:  document.getElementById('clearHunnyConfirm'),
  clearHunnyCancel:   document.getElementById('clearHunnyCancel'),

  // Hot Round modal
  hotRoundBackdrop:  document.getElementById('hotRoundBackdrop'),
  hotRoundMessage:   document.getElementById('hotRoundMessage'),
  hotRoundInput:     document.getElementById('hotRoundInput'),
  hotRoundConfirm:   document.getElementById('hotRoundConfirm'),
  hotRoundSkip:      document.getElementById('hotRoundSkip'),
  hotRoundCancel:    document.getElementById('hotRoundCancel'),

  // Adjustments modal
  adjustmentsBackdrop: document.getElementById('adjustmentsBackdrop'),
  adjustmentsBody:     document.getElementById('adjustmentsBody'),
  adjustmentsClose:    document.getElementById('adjustmentsClose'),

  // Misc
  toast:             document.getElementById('toast')
};


// ============================================================
// TOAST / ALERT
// ============================================================

let toastTimeout = null;

export function alertLike(message) {
  if (!els.toast) {
    window.alert(message);
    return;
  }
  els.toast.textContent = message;
  els.toast.classList.add('toast--visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toast.classList.remove('toast--visible');
  }, 2600);
}


// ============================================================
// PRIMARY RENDER ENTRY POINT
// ============================================================

export function render() {
  renderPlayers();
  renderScores();
  renderWagerScreen();
  renderHistory();
}


// ============================================================
// SETUP: PLAYERS LIST
// ============================================================

function renderPlayers() {
  if (!els.playersList) return;

  if (!state.players.length) {
    els.playersList.innerHTML =
      '<p class="hint">Add at least two family members to begin.</p>';
    return;
  }

  const rows = state.players.map(player => {
    const escapedName = escapeHtml(player.name);
    const pts = clampScore(player.currentPoints);
    return `
      <div class="card card--player">
        <div class="card-main">
          <div class="card-title">${escapedName}</div>
          <div class="card-subtitle">Starting points: ${player.startingPoints}</div>
        </div>
        <div class="card-actions">
          <span class="pill pill--score">${pts}</span>
          <button class="btn btn--ghost" data-action="give-from-pot" data-player-id="${player.id}">Give Hunny</button>
          <button class="btn btn--ghost" data-action="remove-player" data-player-id="${player.id}">Remove</button>
        </div>
      </div>
    `;
  });

  const pot = clampScore(state.pot);
  const potLabel = pot > 0
    ? `Hunny Pot · ${pot} pts`
    : 'Hunny Pot';

  const potControls = `
    <div class="hunny-summary">
      <span class="pill pill--hunny">${potLabel}</span>
      <button class="btn btn--ghost" data-action="add-to-pot">Add</button>
      <button class="btn btn--ghost" data-action="clear-pot">Clear</button>
    </div>
  `;

  els.playersList.innerHTML = potControls + rows.join('');
}


// ============================================================
// SCORES SCREEN
// ============================================================

function renderScores() {
  if (!els.scoresTableBody || !els.hunnyPotLabel) return;

  const sorted = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
  const leader = sorted[0];

  const rows = sorted.map((player, index) => {
    const place = index + 1;
    const isLeader = leader && player.id === leader.id;
    const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;
    const classes = ['score-row'];
    if (isLeader) classes.push('score-row--leader');

    return `
      <tr class="${classes.join(' ')}">
        <td>${placeLabel}</td>
        <td>${escapeHtml(player.name)}</td>
        <td>${clampScore(player.currentPoints)}</td>
      </tr>
    `;
  });

  els.scoresTableBody.innerHTML = rows.join('');

  const pot = clampScore(state.pot);
  els.hunnyPotLabel.textContent = `Hunny Pot: ${pot} pt${pot === 1 ? '' : 's'}`;
}


// ============================================================
// WAGER SCREEN
// ============================================================

function describeWagerMode() {
  const opts = state.gameOptions || {};
  const parts = [];

  parts.push('Authors never gain or lose points from wagers on their own question.');

  if (opts.tableStakes) {
    parts.push('Table stakes is ON: everyone who wagers must wager the same amount.');
  } else {
    parts.push('Table stakes is OFF: players may wager different amounts.');
  }

  if (opts.catchUp) {
    parts.push('Catch-up is ON: if someone falls far behind, the Hunny Pot may help them.');
  } else {
    parts.push('Catch-up is OFF: no automatic help for last place.');
  }

  if (opts.hotRounds) {
    parts.push('Hot Rounds may add extra pot points to winners when the pot is large.');
  } else {
    parts.push('Hot Rounds are disabled.');
  }

  if (opts.autoBonuses) {
    parts.push('Automatic bonuses are enabled for special accomplishments.');
  } else {
    parts.push('Automatic bonuses are disabled.');
  }

  return parts.join(' ');
}

function renderWagerScreen() {
  if (!els.wagerTableBody || !els.wagerHints) return;

  const bet = getCurrentGuessingBet();
  if (!bet) {
    els.wagerTableBody.innerHTML =
      '<tr><td colspan="4" class="hint">No active round. Create a question to start.</td></tr>';
    els.wagerHints.textContent = '';
    return;
  }

  const players = state.players;
  const rows = players.map(player => {
    const available = getAvailablePoints(player.id);
    const escaped   = escapeHtml(player.name);

    const options = players.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');

    return `
      <tr data-bet-player-row data-player-id="${player.id}">
        <td>${escaped}</td>
        <td>
          <select data-guess-player>
            <option value="">— Who said it? —</option>
            ${options}
          </select>
        </td>
        <td>
          <input type="number" class="input input--small"
                 data-amount
                 min="0"
                 max="${available}"
                 value="${Math.min(1, available)}">
        </td>
        <td><span class="pill pill--score">${available}</span></td>
      </tr>
    `;
  });

  els.wagerTableBody.innerHTML = rows.join('');
  els.wagerHints.textContent   = describeWagerMode();
}


// ============================================================
// REVEAL SCREEN (simple rendering)
// ============================================================

export function renderSimpleReveal(result) {
  if (!els.revealContent) return;

  const {
    description,
    attraction,
    land,
    authorNames,
    winners,
    anyCorrect,
    losersPot,
    totalWinnerWager
  } = result;

  const metaParts = [];
  if (attraction) metaParts.push(escapeHtml(attraction));
  if (land)       metaParts.push(escapeHtml(land));
  const meta = metaParts.length ? ` (${metaParts.join(' • ')})` : '';

  const authorLine = authorNames?.length
    ? `Correct author${authorNames.length > 1 ? 's' : ''}: ${authorNames.map(escapeHtml).join(', ')}`
    : 'Correct author unknown';

  let winnerBlock = '';
  if (anyCorrect && winners?.length) {
    winnerBlock = `
      <div class="reveal-section-title">Winners</div>
      <div class="hint">${winners.map(escapeHtml).join('<br>')}</div>
    `;
  } else if (!anyCorrect) {
    winnerBlock = `
      <div class="reveal-section-title">Winners</div>
      <div class="hint">No one guessed correctly this time.</div>
    `;
  }

  const potLine = losersPot > 0
    ? anyCorrect
      ? `Losers contributed ${losersPot} point${losersPot === 1 ? '' : 's'} to the payout pool.`
      : `Losers contributed ${losersPot} point${losersPot === 1 ? '' : 's'} to the Hunny Pot.`
    : 'No points were wagered this round.';

  const optionsHint = describeWagerMode();

  els.revealContent.innerHTML = `
    <div class="reveal-card">
      <div class="reveal-question">
        <div class="reveal-question-text">${escapeHtml(description)}${meta}</div>
        <div class="reveal-author">${authorLine}</div>
      </div>
      ${winnerBlock}
      <div class="reveal-section-title" style="margin-top:.75rem;">Points</div>
      <div class="hint">${escapeHtml(potLine)}</div>
      <div class="reveal-section-title" style="margin-top:.75rem;">How this round scored</div>
      <div class="hint">${escapeHtml(optionsHint)}</div>
    </div>
  `;

  els.revealBackdrop.style.display = 'flex';
}


// ============================================================
// HISTORY
// ============================================================

function renderHistory() {
  if (!els.historyList) return;

  if (!state.bets.length) {
    els.historyList.innerHTML =
      '<p class="hint">No rounds have been played yet.</p>';
    return;
  }

  const items = state.bets
    .filter(b => b.status === 'resolved')
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
    .map(bet => {
      const metaParts = [];
      if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
      if (bet.land)       metaParts.push(escapeHtml(bet.land));
      const meta = metaParts.length ? ` (${metaParts.join(' • ')})` : '';

      const winners = (bet.roundWinners || [])
        .map(id => state.players.find(p => p.id === id)?.name || 'Unknown')
        .map(escapeHtml);

      const winnerLine = winners.length
        ? `Winner${winners.length > 1 ? 's' : ''}: ${winners.join(', ')}`
        : 'No winners this round';

      const scoreLines = Array.isArray(bet.scoreChanges)
        ? bet.scoreChanges.map(sc => {
            const name = state.players.find(p => p.id === sc.playerId)?.name || 'Unknown';
            const delta = sc.delta || 0;
            if (!delta) return null;
            const sign = delta > 0 ? '+' : '';
            return `${escapeHtml(name)}: ${sign}${delta}`;
          }).filter(Boolean)
        : [];

      const scoresHtml = scoreLines.length
        ? `<div class="hint">${scoreLines.map(escapeHtml).join('<br>')}</div>`
        : '';

      const hotBadge = bet.hotRound
        ? '<span class="pill pill--hot">Hot Round</span>'
        : '';

      return `
        <div class="card card--history">
          <div class="card-main">
            <div class="card-title">${escapeHtml(bet.description)}${meta}</div>
            <div class="card-subtitle">
              ${winnerLine} ${hotBadge}
            </div>
            ${scoresHtml}
          </div>
          <div class="card-actions">
            <button class="btn btn--ghost"
                    data-action="reuse-question"
                    data-bet-id="${bet.id}">
              Reuse this question
            </button>
          </div>
        </div>
      `;
    });

  if (!items.length) {
    els.historyList.innerHTML =
      '<p class="hint">No resolved rounds yet.</p>';
  } else {
    els.historyList.innerHTML = items.join('');
  }
}
