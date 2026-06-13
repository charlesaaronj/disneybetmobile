// ============================================================
// ui.js  (entry point)
// Who Said Diz — DOM wiring, event handlers, modal logic,
// screen navigation, and app bootstrap.
//
// This is the only file loaded as type="module" by index.html.
// It imports rendering from ui-render.js and game logic from
// game-logic.js / game-state.js.
//
// Responsibilities:
//   - Screen navigation (showScreen and go* helpers)
//   - Modal open/close wrappers (Hunny Pot, Hot Round,
//     Answer collection, Adjustments)
//   - All addEventListener calls
//   - Theme toggle
//   - App bootstrap (load → enforce → render → setup → focus)
//
// This file does NOT render HTML directly and does NOT
// mutate state directly (with the one noted exception of
// bet.guesses assignment which is flagged for future refactor).
// ============================================================
// --- Lightweight in-page console for iOS debugging ---
// Shows recent console.log messages in a fixed overlay.
// Remove or disable for production builds.

import {
  state,
  loadState,
  saveState,
  enforceMinPot,
  clampScore
} from './game-state.js';

import {
  els,
  render,
  renderHistory,
  renderSimpleReveal,
  alertLike
} from './ui-render.js';

import {
  addPlayer, removePlayer, giveFromPot, addToPot, clearPot,
  getCurrentGuessingBet, finalizeCreateBet, startAnswerPhase,
  getNextAnswerPrompt, savePlayerAnswer, normalizeGuesses,
  resolveGuessingBet, rerollCurrentSelectedAnswer,
  validateTableStakes, resetGameKeepingPlayers, applyRoundAdjustments
} from './game-logic-rounds.js';

import {
  getRandomUnusedGlobalQuestion,
  getRandomQuestionForAttractionWithFallback,
  awardBonus
} from './game-logic-questions.js';

// ============================================================
// SCREEN NAVIGATION
// Six screens live in the DOM simultaneously; only one carries
// .screen--active at a time. All go* helpers call showScreen()
// and scroll to the top so mobile users see the new content.
// ============================================================

const screenIds = ['setup', 'question', 'wager', 'reveal', 'scores', 'history'];
const screens   = {};
screenIds.forEach(id => {
  screens[id] = document.getElementById(`screen-${id}`);
});

// Activate one screen, deactivate all others.
function showScreen(id) {
  screenIds.forEach(name => {
    const el = screens[name];
    if (!el) return;
    el.classList.toggle('screen--active', name === id);
  });

  // Move focus to the screen's first heading for keyboard / AT users.
  // setTimeout defers until after the repaint so the element is visible.
  setTimeout(() => {
    const active = screens[id];
    const heading = active?.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, 50);
}

function goToSetup()    { showScreen('setup'); }

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

// Clear all three question-form fields between rounds.
function resetQuestionForm() {
  els.attractionName.value  = '';
  els.landName.value        = '';
  els.betDescription.value  = '';
}


// ============================================================
// THEME TOGGLE
// Reads / writes data-theme on <html> and persists preference
// to localStorage so it survives page reloads.
// ============================================================

const THEME_KEY = 'disney-line-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  // Update button label to reflect what clicking will do next.
  if (els.themeToggleBtn) {
    els.themeToggleBtn.textContent    = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    els.themeToggleBtn.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }
}

function initTheme() {
  // Respect saved preference, then OS preference, then default to light.
  const saved  = localStorage.getItem(THEME_KEY);
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  applyTheme(saved || prefers);
}

els.themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});


// ============================================================
// HUNNY POT MODALS
// Each modal follows the same pattern:
//   1. Set message / input defaults
//   2. Define onConfirm / onCancel handlers
//   3. Attach handlers
//   4. Show modal + focus input
//   5. close() removes handlers and hides backdrop
// Handlers are removed on close to prevent double-firing.
// ============================================================

// --- Give from Pot ---
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
  els.giveHunnyInput.min   = '1';
  els.giveHunnyInput.max   = String(max);

  const close = () => {
    els.giveHunnyBackdrop.style.display = 'none';
    els.giveHunnyConfirm.removeEventListener('click', onConfirm);
    els.giveHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    giveFromPot(playerId, Number(els.giveHunnyInput.value));
    render();
    close();
  };

  const onCancel = () => close();

  els.giveHunnyConfirm.addEventListener('click', onConfirm);
  els.giveHunnyCancel.addEventListener('click', onCancel);

  els.giveHunnyBackdrop.style.display = 'flex';
  els.giveHunnyInput.focus();
}

// --- Add to Pot ---
function openAddToPotModal() {
  els.addHunnyInput.value = '5';
  els.addHunnyInput.min   = '1';

  const close = () => {
    els.addHunnyBackdrop.style.display = 'none';
    els.addHunnyConfirm.removeEventListener('click', onConfirm);
    els.addHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    addToPot(Number(els.addHunnyInput.value));
    render();
    close();
  };

  const onCancel = () => close();

  els.addHunnyConfirm.addEventListener('click', onConfirm);
  els.addHunnyCancel.addEventListener('click', onCancel);

  els.addHunnyBackdrop.style.display = 'flex';
  els.addHunnyInput.focus();
}

// --- Clear Pot ---
function openClearPotModal() {
  if (!state.pot) return;

  els.clearHunnyMessage.textContent =
    `Clear the Hunny Pot (${state.pot} points)?`;

  const close = () => {
    els.clearHunnyBackdrop.style.display = 'none';
    els.clearHunnyConfirm.removeEventListener('click', onConfirm);
    els.clearHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => { clearPot(); render(); close(); };
  const onCancel  = () => close();

  els.clearHunnyConfirm.addEventListener('click', onConfirm);
  els.clearHunnyCancel.addEventListener('click', onCancel);

  els.clearHunnyBackdrop.style.display = 'flex';
}


// ============================================================
// HOT ROUND MODAL
// Offered when the Hunny Pot has more than 10 points.
// onSubmit receives { hotRound: bool, hotRoundBonus: number }.
// ============================================================

function openHotRoundModal(onSubmit) {
  if (!els.hotRoundBackdrop || !els.hotRoundInput) {
    onSubmit({ hotRound: false, hotRoundBonus: 0 });
    return;
  }

  const max = state.pot;
  els.hotRoundMessage.textContent =
    `The Hunny Pot has ${max} points. Make this a Hunny Pot Hot Round?`;
  els.hotRoundInput.value = String(Math.min(5, max));
  els.hotRoundInput.min   = '1';
  els.hotRoundInput.max   = String(max);

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

  const onSkip   = () => { close(); onSubmit({ hotRound: false, hotRoundBonus: 0 }); };
  const onCancel = () => close();

  els.hotRoundConfirm.addEventListener('click', onConfirm);
  els.hotRoundSkip.addEventListener('click', onSkip);
  els.hotRoundCancel.addEventListener('click', onCancel);

  els.hotRoundBackdrop.style.display = 'flex';
  els.hotRoundInput.focus();
}


// ============================================================
// ANSWER COLLECTION
// Players answer one at a time via the answer modal.
// currentAnswerIndex tracks position in the shuffled order.
// ============================================================

let currentAnswerBetId  = null;
let currentAnswerIndex  = 0;

function showAnswerModal() { els.answerBackdrop.style.display = 'flex'; }
function hideAnswerModal() { els.answerBackdrop.style.display = 'none'; }

// Begin the answer phase for a newly created bet.
function startAnswerPhaseUI(betId) {
  const bet = startAnswerPhase(betId);
  if (!bet) return;
  currentAnswerBetId  = betId;
  currentAnswerIndex  = 0;
  nextAnswerPromptUI();
}

// Prompt the next player, or transition to wager screen if all have answered.
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

  // Build the prompt shown to each player.
  const metaParts = [];
  if (bet.attraction) metaParts.push(bet.attraction);
  if (bet.land)       metaParts.push(bet.land);
  const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}. Only they should see this screen.\n\nQuestion: ${bet.description} ${meta}`;
  els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
  els.answerInput.value = '';

  // Hide ghost button after it has been used once per round.
  if (els.answerGhostBtn) {
    els.answerGhostBtn.disabled     = !!bet.ghostAnswerUsed;
    els.answerGhostBtn.style.display = bet.ghostAnswerUsed ? 'none' : '';
  }

  showAnswerModal();
}

// Save a player's answer (real or ghost) and advance to the next player.
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

els.answerSaveBtn?.addEventListener('click',   () => saveAnswerUI(false));
els.answerCancelBtn?.addEventListener('click', () => hideAnswerModal());
els.answerGhostBtn?.addEventListener('click',  () => saveAnswerUI(true));


// ============================================================
// WAGER GUARDS
// Prevent players from wagering more than their available points.
// Attached after renderBetRows() builds the wager inputs.
// Called from the lockGuessesBtn handler after render().
// ============================================================

export function attachWagerGuards() {
  const rows = [...document.querySelectorAll('[data-bet-player-row]')];

  rows.forEach(row => {
    const playerId = row.dataset.playerId;
    const input    = row.querySelector('[data-amount]');
    if (!input) return;

    input.addEventListener('input', () => {
      const available = state.players.find(p => p.id === playerId)
        ? clampScore(state.players.find(p => p.id === playerId).currentPoints)
        : 0;
      const raw = input.value.trim();
      if (raw === '' || raw === '0') return;
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      if (value > available) {
        input.value = String(available);
        alertLike(`That's the max they can wager this round (${available} points).`);
      }
    });

    input.addEventListener('blur', () => {
      const available = state.players.find(p => p.id === playerId)
        ? clampScore(state.players.find(p => p.id === playerId).currentPoints)
        : 0;
      const raw   = input.value.trim();
      const value = Number(raw);
      if (raw === '' || !Number.isFinite(value) || value < 0) {
        input.value = '1';
        return;
      }
      if (value > available) input.value = String(available);
    });
  });
}

// Read DOM wager rows and return raw guess objects for game-logic.
function buildRawGuessesForBet() {
  return [...document.querySelectorAll('[data-bet-player-row]')].map(row => ({
    playerId:        row.dataset.playerId,
    guessedAuthorId: row.querySelector('[data-guess-player]')?.value || null,
    wager:           Number(row.querySelector('[data-amount]')?.value || 0) || 0
  }));
}


// ============================================================
// ADJUSTMENTS MODAL
// Shows Hot Round payout, automatic bonuses, and catch-up
// results for the most recently resolved round.
//
// FIX: applyRoundAdjustments is now idempotent in game-logic.js
// (guarded by bet.adjustmentsApplied). Opening this modal
// multiple times no longer re-awards bonuses.
//
// FIX: previously passed HTML strings through escapeHtml which
// escaped <br> tags. Lines are now escaped individually and
// joined with <br> after escaping.
// ============================================================

let lastResolvedBetId = null;

function openAdjustmentsModal() {
  if (!lastResolvedBetId) {
    alertLike('No round has just been resolved.');
    return;
  }

  // applyRoundAdjustments is idempotent — safe to call repeatedly.
  const summary = applyRoundAdjustments(lastResolvedBetId);
  if (!summary) {
    alertLike('No adjustments to apply for this round.');
    return;
  }

  const parts = [];

  if (summary.hotRoundLines?.length) {
    parts.push('<div class="reveal-section-title">Hunny Pot Hot Round</div>');
    // FIX: escape each line individually, then join with <br>
    parts.push(
      `<div class="hint">${summary.hotRoundLines.map(l => l.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])).join('<br>')}</div>`
    );
  }

  if (summary.bonusLines?.length) {
    parts.push(
      '<div class="reveal-section-title" style="margin-top:.75rem;">Bonuses</div>'
    );
    parts.push(
      `<div class="hint">${summary.bonusLines.map(l => l.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])).join('<br>')}</div>`
    );
  }

  if (summary.catchUpLine) {
    parts.push(
      '<div class="reveal-section-title" style="margin-top:.75rem;">Catch-up</div>'
    );
    parts.push(`<div class="hint">${summary.catchUpLine}</div>`);
  }

  parts.push(
    '<div class="reveal-section-title" style="margin-top:.75rem;">Hunny Pot</div>'
  );
  parts.push(
    `<div class="hint">Before: ${summary.potBefore} · After: ${summary.potAfter}</div>`
  );

  if (!parts.length) {
    parts.push('<div class="hint">No adjustments this round.</div>');
  }

  els.adjustmentsBody.innerHTML = parts.join('');
  els.adjustmentsBackdrop.style.display = 'flex';

  // Re-render so scoreboard reflects any new bonus points.
  render();
}

els.adjustmentsClose?.addEventListener('click', () => {
  els.adjustmentsBackdrop.style.display = 'none';
});

els.adjustmentsBackdrop?.addEventListener('click', e => {
  if (e.target === els.adjustmentsBackdrop) {
    els.adjustmentsBackdrop.style.display = 'none';
  }
});


// ============================================================
// EVENT DELEGATION
// Replaces the seven window.* globals that were previously
// needed for inline onclick handlers in rendered HTML.
// One listener per container reads data-action + data-* attrs.
// ============================================================

// Players list (setup screen) — pot controls + player actions
els.playersList?.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action   = btn.dataset.action;
  const playerId = btn.dataset.playerId;

  if (action === 'add-to-pot')    openAddToPotModal();
  if (action === 'clear-pot')     openClearPotModal();
  if (action === 'give-from-pot') openGiveFromPotModal(playerId);
  if (action === 'remove-player') { removePlayer(playerId); render(); }
});

// History list — pot controls, give-from-pot, reuse question
els.historyList?.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action   = btn.dataset.action;
  const playerId = btn.dataset.playerId;
  const betId    = btn.dataset.betId;

  if (action === 'add-to-pot')     openAddToPotModal();
  if (action === 'clear-pot')      openClearPotModal();
  if (action === 'give-from-pot')  openGiveFromPotModal(playerId);
  if (action === 'reuse-question') reuseQuestion(betId);
});

// Selected answer panel — reroll answer button
els.selectedAnswerPanel?.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'reroll-answer') {
    rerollCurrentSelectedAnswer();
    render();
  }
});


// ============================================================
// REUSE QUESTION
// Prefills the question form with a resolved round's data and
// navigates to the question screen.
// ============================================================

function reuseQuestion(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
  els.attractionName.value = bet.attraction  || '';
  els.landName.value       = bet.land        || '';
  els.betDescription.value = bet.description || '';
  goToQuestion();
}


// ============================================================
// ATTRACTION AUTOCOMPLETE & AUTO-FILL
// Populates datalist elements from window.PARKS on load.
// When an attraction is selected, auto-fills the land field
// and suggests a question if the question field is empty.
// ============================================================

function setupAttractionSuggestions() {
  if (!window.PARKS) return;
  const attractions = window.PARKS.attractions || [];

  // Populate attraction datalist.
  const dlAttractions = document.getElementById('attractionSuggestions');
  if (dlAttractions) {
    dlAttractions.innerHTML = attractions
      .map(a => `<option value="${a.name.replace(/"/g, '&quot;')}"></option>`)
      .join('');
  }

  // Populate land datalist (deduplicated, sorted).
  const dlLands = document.getElementById('landSuggestions');
  if (dlLands) {
    const lands = Array.from(new Set(attractions.map(a => a.land))).sort();
    dlLands.innerHTML = lands
      .map(land => `<option value="${land.replace(/"/g, '&quot;')}"></option>`)
      .join('');
  }

  // Auto-fill land + suggest question when an attraction is chosen.
  function applyAttractionSelection() {
    const name  = els.attractionName.value.trim().toLowerCase();
    if (!name) return;
    const match = attractions.find(a => a.name.toLowerCase() === name);
    if (!match) return;
    if (match.land) els.landName.value = match.land;
    if (!els.betDescription.value.trim()) {
      const question = getRandomQuestionForAttractionWithFallback(match.name);
      if (question) els.betDescription.value = question;
    }
  }

  els.attractionName?.addEventListener('input',  applyAttractionSelection);
  els.attractionName?.addEventListener('change', applyAttractionSelection);
  els.attractionName?.addEventListener('blur',   applyAttractionSelection);
}


// ============================================================
// BUTTON EVENT LISTENERS
// ============================================================

// --- Add player ---
document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
  const name   = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);
  if (!name)       return alertLike('Enter a family member name.');
  if (points < 0)  return alertLike('Starting points must be 0 or more.');
  addPlayer(name, points);
  render();
  els.playerName.value   = '';
  els.playerPoints.value = '10';
});

// Submit player form on Enter key.
els.playerName?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addPlayerBtn')?.click();
  }
});

// --- Create bet (Answer button) ---
document.getElementById('createBetBtn')?.addEventListener('click', () => {
  if (!state.players || state.players.length < 2) {
    return alertLike('You need at least two family members to play.');
  }

  const attraction = els.attractionName.value.trim();
  const land       = els.landName.value.trim();
  const question   = els.betDescription.value.trim();

  if (!attraction || !land || !question) {
    return alertLike('Attraction, Land, and Question are all required.');
  }

  // Offer Hot Round if the pot is healthy enough.
  if (state.pot > 10) {
    openHotRoundModal(selection => {
      if (!selection) return;
      const bet = finalizeCreateBet({
        attraction,
        land,
        question,
        hotRound:      selection.hotRound,
        hotRoundBonus: selection.hotRoundBonus
      });
      if (!bet) return;
      render();
      startAnswerPhaseUI(bet.id);
    });
  } else {
    const bet = finalizeCreateBet({ attraction, land, question, hotRound: false, hotRoundBonus: 0 });
    if (!bet) return;
    render();
    startAnswerPhaseUI(bet.id);
  }
});

// --- Random question ---
document.getElementById('randomBetBtn')?.addEventListener('click', () => {
  const q = getRandomUnusedGlobalQuestion();
  if (!q) return alertLike('No global question ideas are available yet.');
  els.betDescription.value = q;
});

// --- Clear question form ---
document.getElementById('clearBetFormBtn')?.addEventListener('click', () => {
  resetQuestionForm();
});

// --- Lock wagers & reveal ---
document.getElementById('lockGuessesBtn')?.addEventListener('click', () => {
  const bet = getCurrentGuessingBet();
  if (!bet) return alertLike('No round is ready for guessing right now.');

  const rawGuesses  = buildRawGuessesForBet();
  const guesses     = normalizeGuesses(rawGuesses);
  if (!guesses) return;

  const tableCheck = validateTableStakes(guesses);
  if (!tableCheck.ok) return alertLike(tableCheck.message);

  // TODO: move this assignment into resolveGuessingBet() in game-logic.js
  // so ui.js never mutates state directly.
  bet.guesses = guesses;
  saveState();

  const result = resolveGuessingBet(bet.id);
  if (!result) return;

  lastResolvedBetId = bet.id;
  renderSimpleReveal(result);

  render();
  goToReveal();
});

// --- Clear everything ---
document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  // TODO: move this into a resetGame() function in game-logic.js
  state.players      = [];
  state.bets         = [];
  state.pot          = 0;
  state.awardedBonuses = [];
  saveState();
  render();
  goToSetup();
});

// --- Nav buttons ---
document.getElementById('startGameBtn')?.addEventListener('click', () => {
  if (state.players.length < 2) {
    return alertLike('Add at least two family members first.');
  }
  resetQuestionForm();
  goToQuestion();
});

document.getElementById('toScoresBtn')?.addEventListener('click',     () => goToScores());
document.getElementById('nextRoundBtn')?.addEventListener('click',    () => { resetQuestionForm(); goToQuestion(); });
document.getElementById('viewHistoryBtn')?.addEventListener('click',  () => { render(); goToHistory(); });
document.getElementById('backToScoresBtn')?.addEventListener('click', () => goToScores());
document.getElementById('restartGameBtn')?.addEventListener('click',  () => { resetGameKeepingPlayers(); render(); goToSetup(); });
document.getElementById('viewAdjustmentsBtn')?.addEventListener('click', () => openAdjustmentsModal());

// --- Reveal modal close ---
els.revealCloseBtn?.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});

els.revealBackdrop?.addEventListener('click', e => {
  if (e.target === els.revealBackdrop) els.revealBackdrop.style.display = 'none';
});


// ============================================================
// BOOTSTRAP
// Runs once on page load. Order matters:
//   1. loadState()          — hydrate from localStorage
//   2. enforceMinPot()      — apply pot floor to loaded state
//   3. saveState() if needed — persist the enforced pot
//   4. render()             — first paint
//   5. setupAttractionSuggestions() — populate datalists
//   6. initTheme()          — apply saved / OS theme preference
//   7. goToSetup()          — show the setup screen
//   8. focus playerName     — ready for first input
// ============================================================

window.addEventListener('load', () => {
  loadState();

  // FIX: if enforceMinPot changed the pot, persist it immediately
  // so a reload without any other interaction still saves the floor.
  const potChanged = enforceMinPot();
  if (potChanged) saveState();

  render();
  setupAttractionSuggestions();
  initTheme();
  goToSetup();
  els.playerName?.focus();
});
