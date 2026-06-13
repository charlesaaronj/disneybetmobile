// ============================================================
// ui-render.js
// Who Said Diz — all DOM rendering functions.
//
// This module is responsible ONLY for reading state and writing
// to the DOM. It never attaches event listeners and never
// mutates state directly.
//
// Imported by ui.js, which calls render() after every state change.
//
// Exports:
//   render()                  — re-renders all panels at once
//   renderPlayers()           — player chip list + Hunny Pot row
//   renderScoreboard()        — ranked score cards (both screens)
//   renderBetPlayers()        — wager input rows for active round
//   renderSelectedAnswerPanel() — chosen answer + question meta
//   renderOpenMetrics()       — round status counts + pot total
//   renderOpenBets()          — active (unresolved) round cards
//   renderHistory()           — resolved rounds + pot controls
//   renderQualifiedBonuses()  — recently awarded bonus log
//   renderBonusLibrary()      — manual bonus award cards
//   renderSimpleReveal()      — wager-only round result
//   renderGuessingRound()     — alias used by renderBetPlayers
// ============================================================

import {
  state,
  clampScore,
  escapeHtml,
  getAvailablePoints
} from './game-state.js';

import {
  getCurrentGuessingBet,
  applyRoundAdjustments
} from './game-logic-rounds.js';


// ============================================================
// DOM ELEMENT REFERENCES
// Shared with ui.js via the exported `els` object.
// All getElementById calls are centralized here so neither
// file has to hunt for selectors.
// ============================================================

export const els = {
  // Setup screen
  playerName:    document.getElementById('playerName'),
  playerPoints:  document.getElementById('playerPoints'),
  playersList:   document.getElementById('playersList'),
  scoreboard:    document.getElementById('scoreboard'),

  // Question screen
  betDescription:  document.getElementById('betDescription'),
  attractionName:  document.getElementById('attractionName'),
  landName:        document.getElementById('landName'),

  // Wager screen
  betPlayers:           document.getElementById('betPlayers'),
  selectedAnswerPanel:  document.getElementById('selectedAnswerPanel'),

  // History screen
  openBets:        document.getElementById('openBets'),
  historyList:     document.getElementById('historyList'),
  openBetMetrics:  document.getElementById('openBetMetrics'),

  // Answer modal
  answerBackdrop:     document.getElementById('answerModalBackdrop'),
  answerPrompt:       document.getElementById('answerModalPrompt'),
  answerPlayerLabel:  document.getElementById('answerModalPlayerLabel'),
  answerInput:        document.getElementById('answerModalInput'),
  answerSaveBtn:      document.getElementById('answerModalSaveBtn'),
  answerCancelBtn:    document.getElementById('answerModalCancelBtn'),
  answerGhostBtn:     document.getElementById('answerModalGhostBtn'),

  // Reveal modal
  revealBackdrop:   document.getElementById('revealModalBackdrop'),
  revealTitle:      document.getElementById('revealModalTitle'),
  revealSub:        document.getElementById('revealModalSub'),
  revealBody:       document.getElementById('revealModalBody'),
  revealCloseBtn:   document.getElementById('revealModalCloseBtn'),
  revealSummary:    document.getElementById('revealSummary'),

  // Add Hunny modal
  addHunnyBackdrop: document.getElementById('addHunnyModalBackdrop'),
  addHunnyInput:    document.getElementById('addHunnyModalInput'),
  addHunnyCancel:   document.getElementById('addHunnyModalCancel'),
  addHunnyConfirm:  document.getElementById('addHunnyModalConfirm'),

  // Give Hunny modal
  giveHunnyBackdrop: document.getElementById('giveHunnyModalBackdrop'),
  giveHunnyMessage:  document.getElementById('giveHunnyModalMessage'),
  giveHunnyInput:    document.getElementById('giveHunnyModalInput'),
  giveHunnyCancel:   document.getElementById('giveHunnyModalCancel'),
  giveHunnyConfirm:  document.getElementById('giveHunnyModalConfirm'),

  // Clear Hunny modal
  clearHunnyBackdrop: document.getElementById('clearHunnyModalBackdrop'),
  clearHunnyMessage:  document.getElementById('clearHunnyModalMessage'),
  clearHunnyCancel:   document.getElementById('clearHunnyModalCancel'),
  clearHunnyConfirm:  document.getElementById('clearHunnyModalConfirm'),

  // Hot Round modal
  hotRoundBackdrop: document.getElementById('hotRoundModalBackdrop'),
  hotRoundMessage:  document.getElementById('hotRoundModalMessage'),
  hotRoundInput:    document.getElementById('hotRoundModalInput'),
  hotRoundCancel:   document.getElementById('hotRoundModalCancel'),
  hotRoundSkip:     document.getElementById('hotRoundModalSkip'),
  hotRoundConfirm:  document.getElementById('hotRoundModalConfirm'),

  // Adjustments modal
  adjustmentsBackdrop: document.getElementById('adjustmentsModalBackdrop'),
  adjustmentsBody:     document.getElementById('adjustmentsModalBody'),
  adjustmentsClose:    document.getElementById('adjustmentsModalClose'),

  // Bonus panels (appear on both setup and scores screens)
  qualifiedBonusPanel:       document.getElementById('qualifiedBonusPanel'),
  qualifiedBonusPanelScores: document.getElementById('qualifiedBonusPanelScores'),
  bonusLibrary:              document.getElementById('bonusLibrary'),

  // Scores screen scoreboard (separate element from setup screen)
  scoreboardScoresScreen: document.getElementById('scoreboardScoresScreen'),

  // Theme toggle button (added in updated index.html)
  themeToggleBtn: document.getElementById('themeToggleBtn')
};


// ============================================================
// alertLike(message)
// FIX: moved here from game-state.js, which must not touch the DOM.
// Shows a brief toast notification at the bottom of the screen.
// Auto-dismisses after 2 seconds.
// ============================================================

export function alertLike(message) {
  // Remove any existing toast before showing a new one.
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.textContent = message;

  Object.assign(toast.style, {
    position:    'fixed',
    left:        '50%',
    bottom:      '16px',
    transform:   'translateX(-50%)',
    zIndex:      '999',
    padding:     '10px 14px',
    borderRadius:'999px',
    background:  '#000',
    color:       '#fff',
    maxWidth:    '90vw',
    textAlign:   'center',
    fontSize:    '0.95rem'
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}


// ============================================================
// renderPlayers()
// Renders the player chip list on the setup screen, including
// the Hunny Pot control row at the top.
// Uses data-action / data-player-id attributes for event
// delegation (no inline onclick handlers).
// ============================================================

export function renderPlayers() {
  if (!state.players.length) {
    els.playersList.innerHTML =
      '<div class="empty">No family members yet. Add names above to begin.</div>';
    return;
  }

  // Hunny Pot row — always shown at the top of the player list.
  const potHtml = `
    <div class="player-chip" style="margin-bottom:.5rem;">
      <div class="player-chip__main">
        <div>
          <div class="player-chip__name">Hunny Pot</div>
          <div class="player-chip__meta">Shared bonus points for big swings.</div>
        </div>
      </div>
      <div class="player-chip__actions small-actions-hunny">
        <span class="pill pot-pill-total">Hunny Pot ${state.pot}</span>
        <button class="btn btn-secondary btn-xs" type="button"
          data-action="add-to-pot">Add pts</button>
        <button class="btn btn-danger btn-xs" type="button"
          data-action="clear-pot">Clear</button>
      </div>
    </div>
  `;

  const playersHtml = state.players.map(p => {
    // Only show "Give from Hunny Pot" if the player is at 0 and the pot has points.
    const canReceive = clampScore(p.currentPoints) === 0 && state.pot > 0;

    // Two-letter initials from the player's name.
    const initials = p.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return `
      <div class="player-chip">
        <div class="player-chip__main">
          <div class="player-chip__avatar">${escapeHtml(initials || '?')}</div>
          <div>
            <div class="player-chip__name">${escapeHtml(p.name)}</div>
            <div class="player-chip__meta">
              Started with ${p.startingPoints} · Now ${clampScore(p.currentPoints)}
            </div>
          </div>
        </div>
        <div class="player-chip__actions">
          ${canReceive ? `
            <button class="btn btn-secondary btn-xs" type="button"
              data-action="give-from-pot"
              data-player-id="${p.id}">
              Give from Hunny Pot
            </button>` : ''}
          <button class="btn btn-danger btn-xs" type="button"
            data-action="remove-player"
            data-player-id="${p.id}">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');

  els.playersList.innerHTML = potHtml + playersHtml;
}


// ============================================================
// renderScoreboard()
// Renders ranked score cards on both the setup screen and the
// scores screen (two separate DOM elements, same HTML).
// ============================================================

export function renderScoreboard() {
  if (!state.players.length) {
    const empty =
      '<div class="empty">Scores will appear here once players are added.</div>';
    els.scoreboard.innerHTML = empty;
    if (els.scoreboardScoresScreen) els.scoreboardScoresScreen.innerHTML = empty;
    return;
  }

  // Sort players highest score first.
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


// ============================================================
// renderQualifiedBonuses()
// Shows the most recent 6 awarded bonuses on both the setup
// screen and the scores screen.
// ============================================================

export function renderQualifiedBonuses() {
  if (!els.qualifiedBonusPanel) return;

  if (!state.awardedBonuses.length) {
    const empty = '<div class="empty">No bonuses awarded yet.</div>';
    els.qualifiedBonusPanel.innerHTML = empty;
    if (els.qualifiedBonusPanelScores) {
      els.qualifiedBonusPanelScores.innerHTML = empty;
    }
    return;
  }

  const html = state.awardedBonuses
    .slice(0, 6) // show only the 6 most recent
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


// ============================================================
// renderOpenMetrics()
// Four-cell summary: answering rounds, guessing rounds,
// resolved rounds, and Hunny Pot total.
// Shown at the top of the history screen.
// ============================================================

export function renderOpenMetrics() {
  const answering = state.bets.filter(b => b.status === 'answering').length;
  const guessing  = state.bets.filter(b => b.status === 'guessing').length;
  const resolved  = state.bets.filter(b => b.status === 'resolved').length;

  els.openBetMetrics.innerHTML = `
    <div class="metric">
      <span class="hint">Answering</span>
      <span class="metric-value">${answering}</span>
    </div>
    <div class="metric">
      <span class="hint">Guessing</span>
      <span class="metric-value">${guessing}</span>
    </div>
    <div class="metric">
      <span class="hint">Resolved</span>
      <span class="metric-value">${resolved}</span>
    </div>
    <div class="metric">
      <span class="hint">Hunny Pot</span>
      <span class="metric-value">${state.pot}</span>
    </div>
  `;
}


// ============================================================
// renderOpenBets()
// Lists all unresolved rounds (answering or guessing status)
// on the history screen.
// ============================================================

export function renderOpenBets() {
  const open = state.bets.filter(b => b.status !== 'resolved');

  if (!open.length) {
    els.openBets.innerHTML =
      '<div class="empty">No active rounds. Start a new question above.</div>';
    return;
  }

  els.openBets.innerHTML = open.map(bet => {
    const statusLabel = bet.status === 'answering'
      ? 'Collecting answers'
      : 'Guessing & wagering';

    const metaParts = [];
    if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
    if (bet.land)       metaParts.push(escapeHtml(bet.land));
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


// ============================================================
// renderHistory()
// Resolved rounds list on the history screen, plus Hunny Pot
// controls and per-player give buttons between questions.
// Uses data-action attributes for event delegation.
// ============================================================

export function renderHistory() {
  // Per-player "Give from Hunny Pot" rows shown above the history list.
  const playerGiveHtml = state.players.length
    ? state.players.map(p => `
        <div class="player-chip" style="margin-top:.5rem;">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <div class="hint">${clampScore(p.currentPoints)} points right now</div>
          </div>
          <div class="small-actions">
            <button class="btn btn-secondary" type="button"
              data-action="give-from-pot"
              data-player-id="${p.id}"
              ${state.pot > 0 ? '' : 'disabled'}>
              Give from Hunny Pot
            </button>
          </div>
        </div>
      `).join('')
    : '<div class="empty">No players yet.</div>';

  // Hunny Pot control panel shown at the top of the history list.
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
        <button class="btn btn-secondary" type="button"
          data-action="add-to-pot">Add Pts</button>
        <button class="btn btn-danger" type="button"
          data-action="clear-pot">Clear</button>
      </div>
      <div class="stack" style="margin-top:.75rem;">
        ${playerGiveHtml}
      </div>
    </article>
  `;

  const resolved = state.bets.filter(b => b.status === 'resolved');

  if (!resolved.length) {
    els.historyList.innerHTML =
      potControls +
      '<div class="empty">Resolved rounds will stay here so you can reuse fun questions later.</div>';
    return;
  }

  const historyHtml = resolved.map(bet => {
    // Support both legacy single-author and newer multi-author rounds.
    const correctAuthors = (bet.correctAuthors?.length
      ? bet.correctAuthors
      : (bet.correctAuthorId ? [bet.correctAuthorId] : []));

    const winners = (bet.guesses || [])
      .filter(g => correctAuthors.includes(g.guessedAuthorId) && g.wager > 0)
      .map(g => {
        const player = state.players.find(p => p.id === g.playerId);
        return player ? `${player.name} (wagered ${g.wager})` : null;
      })
      .filter(Boolean);

    const metaParts = [];
    if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
    if (bet.land)       metaParts.push(escapeHtml(bet.land));
    const metaText = metaParts.join(' • ');

    const hot = bet.hotRound && bet.hotRoundBonus > 0
      ? `<div class="hint" style="margin-top:.35rem;">
           <strong>Hot Round:</strong> +${bet.hotRoundBonus} Hunny Pot bonus
         </div>`
      : '';

    // Per-player point deltas recorded when the round was resolved.
    let scoreChangeHtml = '';
    if (Array.isArray(bet.scoreChanges) && bet.scoreChanges.length) {
      const lines = bet.scoreChanges.map(change => {
        const player = state.players.find(p => p.id === change.playerId);
        const name   = player ? player.name : 'Unknown';
        const delta  = change.delta || 0;
        if (delta > 0)  return `${escapeHtml(name)} (+${delta})`;
        if (delta < 0)  return `${escapeHtml(name)} (${delta})`;
        return `${escapeHtml(name)} (no change)`;
      });

      scoreChangeHtml = `
        <div class="hint" style="margin-top:0.25rem;">
          <strong>Points this round:</strong> ${lines.join(', ')}
        </div>
      `;
    }

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
        ${scoreChangeHtml}
        <div class="small-actions" style="margin-top:0.5rem;">
          <button class="btn btn-secondary" type="button"
            data-action="reuse-question"
            data-bet-id="${bet.id}">
            Reuse this question
          </button>
        </div>
      </article>
    `;
  }).join('');

  els.historyList.innerHTML = potControls + historyHtml;
}


// ============================================================
// renderBetPlayers() / renderGuessingRound() / renderBetRows()
// Renders the per-player wager inputs on the wager screen.
// renderBetPlayers() is the public entry point called by render().
// ============================================================

export function renderGuessingRound() {
  renderBetRows();
}

export function renderBetPlayers() {
  const guessingBet = getCurrentGuessingBet();
  if (guessingBet) {
    renderGuessingRound(guessingBet);
  } else {
    renderBetRows();
  }
}

function renderBetRows() {
  if (!state.players.length) {
    els.betPlayers.innerHTML =
      '<div class="empty">Add players, then start a round.</div>';
    return;
  }

  const bet   = getCurrentGuessingBet();
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
          <div class="hint">Can wager up to ${available} points this round</div>
        </div>
        <div class="field-group">
          <div class="field">
            <label class="field__label">Who said it?</label>
            <select class="field__input" data-guess-player ${bet ? '' : 'disabled'}>
              ${bet
                ? state.players
                    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
                    .join('')
                : ''}
            </select>
          </div>
          <div class="field">
            <label class="field__label">Wager</label>
            <input
              class="field__input"
              data-amount
              type="number"
              min="0"
              step="1"
              value="1"
              placeholder="1"
              inputmode="numeric"
              pattern="[0-9]*"
              ${bet ? '' : 'disabled'}
            />
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// ============================================================
// renderSelectedAnswerPanel()
// Shows the chosen answer, question, attraction/land meta, and
// Hot Round bonus amount on the wager screen's left panel.
// ============================================================

export function renderSelectedAnswerPanel() {
  if (!els.selectedAnswerPanel) return;

  const bet = getCurrentGuessingBet();
  if (!bet) {
    els.selectedAnswerPanel.innerHTML =
      '<div class="empty">The selected answer and question will appear here once a round reaches guessing.</div>';
    return;
  }

  const chosen     = bet.answers.find(a => a.id === bet.chosenAnswerId);
  const answerText = chosen ? chosen.text : '';
  const meta       = [bet.attraction, bet.land].filter(Boolean).join(' • ');
  const canReroll  = Array.isArray(bet.answers) && bet.answers.length > 1;

  const hot = bet.hotRound && bet.hotRoundBonus > 0
    ? `<div class="field">
         <div class="hint">+${bet.hotRoundBonus} from the Hunny Pot</div>
       </div>`
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
      ${meta ? `
        <div class="field">
          <label>Attraction / Land</label>
          <div class="hint">${escapeHtml(meta)}</div>
        </div>` : ''}
      ${hot}
      ${canReroll ? `
        <div class="small-actions" style="margin-top:.5rem;">
          <button class="btn btn-secondary" type="button"
            data-action="reroll-answer">
            Select new answer
          </button>
        </div>` : ''}
    </div>
  `;
}


// ============================================================
// renderBonusLibrary()
// Lists configurable bonus cards on the history screen with
// a contextual qualification hint for each bonus type.
// ============================================================

export function renderBonusLibrary() {
  if (!els.bonusLibrary) return;

  if (!state.bonuses?.length) {
    els.bonusLibrary.innerHTML = '<div class="empty">No bonus rules defined.</div>';
    return;
  }

  // Use the most recently resolved round's land for the multiLand hint.
  const latest     = state.bets.find(b => b.status === 'resolved');
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


// ============================================================
// renderSimpleReveal(result)
// Populates the reveal screen with the wager-only round result
// (who said it, who won). Bonuses and adjustments are a
// separate step via the adjustments modal.
//
// FIX: previously passed HTML strings through escapeHtml which
// escaped the <br> tags themselves. Lines are now escaped
// individually and joined with <br> after escaping.
// ============================================================

export function renderSimpleReveal(result) {
  const parts = [];

  // --- Who said it ---
  const authorLabel = result.authorNames.length > 1 ? 'Authors' : 'Author';
  parts.push(`<div class="reveal-section-title">${authorLabel}</div>`);
  parts.push(
    `<div class="hint">${
      result.authorNames.map(escapeHtml).join(', ') || 'Unknown'
    }</div>`
  );

  // --- Attraction / land ---
  if (result.attraction || result.land) {
    parts.push(
      `<div class="reveal-section-title" style="margin-top:.75rem;">Attraction / Land</div>`
    );
    const meta = [result.attraction, result.land].filter(Boolean).map(escapeHtml).join(' • ');
    parts.push(`<div class="hint">${meta}</div>`);
  }

  // --- Winners ---
  parts.push(
    `<div class="reveal-section-title" style="margin-top:.75rem;">Winners (wagers only)</div>`
  );
  if (result.anyCorrect && result.winners.length) {
    parts.push(
      `<div class="hint">${result.winners.map(escapeHtml).join(', ')}</div>`
    );
  } else if (result.losersPot > 0) {
    parts.push(
      '<div class="hint">No one guessed correctly. All losing wagers went to the Hunny Pot.</div>'
    );
  } else {
    parts.push('<div class="hint">No one placed a wager this round.</div>');
  }

  const html = parts.join('');

  els.revealTitle.textContent = 'Round result';
  els.revealSub.textContent   = 'Who said it and how wagers paid out (before bonuses).';
  els.revealBody.innerHTML    = html;
  if (els.revealSummary) els.revealSummary.innerHTML = html;
}


// ============================================================
// render()
// Central re-render: updates all panels and screens at once.
// Called from ui.js after every state-mutating action.
// ============================================================

export function render() {
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
