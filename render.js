// render.js
// All DOM rendering based on current state.

import { state, clampScore, escapeHtml } from './state.js';
import { els } from './dom.js';
import { getCurrentGuessingBet } from './bets.js';
import { addToPot, clearPot, giveFromPot } from './players.js';

// Render the setup screen players list and Hunny Pot chip.
function renderPlayers() {
  if (!state.players.length) {
    els.playersList.innerHTML =
      '<div class="empty">No family members yet. Add names above to begin.</div>';
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

// ...then move over your other `renderScoreboard`, `renderOpenMetrics`,
// `renderOpenBets`, `renderHistory`, `renderBetPlayers`, `renderSelectedAnswerPanel`,
// `renderQualifiedBonuses`, `renderBonusLibrary` functions unchanged,
// with imports fixed at the top.

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
