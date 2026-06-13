// ============================================================
// ui.js
// Who Said Diz — DOM wiring, event handlers, screen navigation.
// ============================================================

import {
  state,
  loadState,
  saveState,
  enforceMinPot,
  clampScore,
  DEFAULT_OPTIONS
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
  normalizeGuesses,
  resolveGuessingBet,
  rerollCurrentSelectedAnswer,
  validateTableStakes,
  resetGameKeepingPlayers,
  applyRoundAdjustments,
  awardBonus,
  setGameMode,
  updateGameOptions
} from './game-logic-rounds.js';

import {
  getRandomUnusedGlobalQuestion,
  getRandomQuestionForAttractionWithFallback
} from './game-logic-questions.js';

import {
  els,
  render,
  renderSimpleReveal,
  alertLike
} from './ui-render.js';

console.log('Who Said Diz UI loaded');


// ============================================================
// SCREEN NAVIGATION
// ============================================================

const screenIds = ['setup', 'question', 'wager', 'reveal', 'scores', 'history'];
const screens   = {};
screenIds.forEach(id => {
  screens[id] = document.getElementById(`screen-${id}`);
});

function showScreen(id) {
  screenIds.forEach(name => {
    const el = screens[name];
    if (!el) return;
    el.classList.toggle('screen--active', name === id);
  });
  setTimeout(() => {
    const active  = screens[id];
    const heading = active?.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, 50);
}

function goToSetup()    { showScreen('setup');    }
function goToQuestion() { showScreen('question'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goToWager()    { showScreen('wager');    window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goToReveal()   { showScreen('reveal');   window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goToScores()   { showScreen('scores');   window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goToHistory()  { showScreen('history');  window.scrollTo({ top: 0, behavior: 'smooth' }); }

function resetQuestionForm() {
  els.attractionName.value  = '';
  els.landName.value        = '';
  els.betDescription.value  = '';
}


// ============================================================
// THEME
// ============================================================

const THEME_KEY = 'disney-line-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (els.themeToggleBtn) {
    els.themeToggleBtn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
}

function initTheme() {
  const saved   = localStorage.getItem(THEME_KEY);
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || prefers);
}

els.themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});


// ============================================================
// GAME MODE + OPTIONS
// ============================================================

const modeRadios = {
  simple:      document.getElementById('gameMode-simple'),
  competitive: document.getElementById('gameMode-competitive'),
  custom:      document.getElementById('gameMode-custom')
};

const customOptionEls = {
  tableStakes: document.getElementById('option-tableStakes'),
  catchUp:     document.getElementById('option-catchUp'),
  hotRounds:   document.getElementById('option-hotRounds'),
  autoBonuses: document.getElementById('option-autoBonuses')
};

const modeDescriptionEl = document.getElementById('gameModeDescription');

function describeMode(mode, opts) {
  const pieces = [];
  pieces.push(mode === 'simple'
    ? 'Simple: relaxed scoring, great for families.'
    : mode === 'competitive'
    ? 'Competitive: strict scoring, no catch-up.'
    : 'Custom: you choose all scoring rules.');
  pieces.push(opts.tableStakes
    ? 'Everyone who wagers must wager the same amount.'
    : 'Players can wager different amounts.');
  pieces.push(opts.catchUp
    ? 'Catch-up ON.'
    : 'Catch-up OFF.');
  pieces.push(opts.hotRounds
    ? 'Hot Rounds enabled.'
    : 'Hot Rounds disabled.');
  pieces.push(opts.autoBonuses
    ? 'Automatic bonuses enabled.'
    : 'Automatic bonuses disabled.');
  pieces.push('Authors never gain or lose points from their own round.');
  return pieces.join(' ');
}

function syncModeUIFromState() {
  const mode = state.gameMode || 'competitive';
  const opts = state.gameOptions || DEFAULT_OPTIONS.competitive;

  if (modeRadios[mode]) modeRadios[mode].checked = true;

  const customEnabled = mode === 'custom';
  Object.values(customOptionEls).forEach(el => {
    if (!el) return;
    el.disabled = !customEnabled;
  });

  if (customOptionEls.tableStakes) customOptionEls.tableStakes.checked = !!opts.tableStakes;
  if (customOptionEls.catchUp)     customOptionEls.catchUp.checked     = !!opts.catchUp;
  if (customOptionEls.hotRounds)   customOptionEls.hotRounds.checked   = !!opts.hotRounds;
  if (customOptionEls.autoBonuses) customOptionEls.autoBonuses.checked = !!opts.autoBonuses;

  if (modeDescriptionEl) {
    modeDescriptionEl.textContent = describeMode(mode, opts);
  }
}

function onModeChanged(newMode) {
  let modeOptions = state.gameOptions;
  if (newMode === 'simple' || newMode === 'competitive') {
    modeOptions = { ...DEFAULT_OPTIONS[newMode] };
  }
  setGameMode(newMode, modeOptions);
  syncModeUIFromState();
  render();
}

Object.entries(modeRadios).forEach(([mode, el]) => {
  if (!el) return;
  el.addEventListener('change', () => {
    if (el.checked) onModeChanged(mode);
  });
});

Object.entries(customOptionEls).forEach(([key, el]) => {
  if (!el) return;
  el.addEventListener('change', () => {
    updateGameOptions({ [key]: !!el.checked });
    syncModeUIFromState();
    render();
  });
});


// ============================================================
// HUNNY POT MODALS
// ============================================================

function openGiveFromPotModal(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  if (state.pot <= 0) { alertLike('No points in the Hunny Pot right now.'); return; }

  const max = state.pot;
  els.giveHunnyMessage.textContent =
    `How many points to give ${player.name}? (Max ${max})`;
  els.giveHunnyInput.value = String(max);
  els.giveHunnyInput.min   = '1';
  els.giveHunnyInput.max   = String(max);

  const close = () => {
    els.giveHunnyBackdrop.style.display = 'none';
    els.giveHunnyConfirm.removeEventListener('click', onConfirm);
    els.giveHunnyCancel.removeEventListener('click', onCancel);
  };
  const onConfirm = () => { giveFromPot(playerId, Number(els.giveHunnyInput.value)); render(); close(); };
  const onCancel  = () => close();
  els.giveHunnyConfirm.addEventListener('click', onConfirm);
  els.giveHunnyCancel.addEventListener('click', onCancel);
  els.giveHunnyBackdrop.style.display = 'flex';
  els.giveHunnyInput.focus();
}

function openAddToPotModal() {
  els.addHunnyInput.value = '5';
  els.addHunnyInput.min   = '1';

  const close = () => {
    els.addHunnyBackdrop.style.display = 'none';
    els.addHunnyConfirm.removeEventListener('click', onConfirm);
    els.addHunnyCancel.removeEventListener('click', onCancel);
  };
  const onConfirm = () => { addToPot(Number(els.addHunnyInput.value)); render(); close(); };
  const onCancel  = () => close();
  els.addHunnyConfirm.addEventListener('click', onConfirm);
  els.addHunnyCancel.addEventListener('click', onCancel);
  els.addHunnyBackdrop.style.display = 'flex';
  els.addHunnyInput.focus();
}

function openClearPotModal() {
  if (!state.pot) return;
  els.clearHunnyMessage.textContent = `Clear the Hunny Pot (${state.pot} points)?`;

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
// ============================================================

function openHotRoundModal(onSubmit) {
  if (!state.gameOptions?.hotRounds) {
    onSubmit({ hotRound: false, hotRoundBonus: 0 });
    return;
  }
  if (!els.hotRoundBackdrop || !els.hotRoundInput) {
    onSubmit({ hotRound: false, hotRoundBonus: 0 });
    return;
  }

  const max = state.pot;
  els.hotRoundMessage.textContent =
    `The Hunny Pot has ${max} pts. Make this a Hot Round?`;
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
    if (!Number.isFinite(amount) || amount <= 0) { alertLike('Enter a number greater than 0.'); return; }
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
// ============================================================

let currentAnswerBetId = null;
let currentAnswerIndex = 0;

function showAnswerModal() { els.answerBackdrop.style.display = 'flex'; }
function hideAnswerModal() { els.answerBackdrop.style.display = 'none'; }

function startAnswerPhaseUI(betId) {
  const bet = startAnswerPhase(betId);
  if (!bet) return;
  currentAnswerBetId = betId;
  currentAnswerIndex = 0;
  nextAnswerPromptUI();
}

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
  if (bet.land)       metaParts.push(bet.land);
  const meta = metaParts.length ? ` (${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}.\n\n${bet.description}${meta}`;
  els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
  els.answerInput.value = '';

  if (els.answerGhostBtn) {
    els.answerGhostBtn.disabled      = !!bet.ghostAnswerUsed;
    els.answerGhostBtn.style.display = bet.ghostAnswerUsed ? 'none' : '';
  }

  showAnswerModal();
}

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
      ? 'No ride fragments available right now.'
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
// ============================================================

function buildRawGuessesForBet() {
  return [...document.querySelectorAll('[data-bet-player-row]')].map(row => ({
    playerId:        row.dataset.playerId,
    guessedAuthorId: row.querySelector('[data-guess-player]')?.value || null,
    wager:           Number(row.querySelector('[data-amount]')?.value || 0) || 0
  }));
}


// ============================================================
// ADJUSTMENTS MODAL
// ============================================================

let lastResolvedBetId = null;

function openAdjustmentsModal() {
  if (!lastResolvedBetId) { alertLike('No round has just been resolved.'); return; }

  const summary = applyRoundAdjustments(lastResolvedBetId);
  if (!summary) { alertLike('No adjustments to apply for this round.'); return; }

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]
  );

  const parts = [];

  if (summary.hotRoundLines?.length) {
    parts.push('<div class="reveal-section-title">Hot Round</div>');
    parts.push(`<div class="hint">${summary.hotRoundLines.map(esc).join('<br>')}</div>`);
  }

  if (summary.bonusLines?.length) {
    parts.push('<div class="reveal-section-title" style="margin-top:.75rem;">Bonuses</div>');
    parts.push(`<div class="hint">${summary.bonusLines.map(esc).join('<br>')}</div>`);
  }

  if (summary.catchUpLine) {
    parts.push('<div class="reveal-section-title" style="margin-top:.75rem;">Catch-up</div>');
    parts.push(`<div class="hint">${esc(summary.catchUpLine)}</div>`);
  }

  parts.push('<div class="reveal-section-title" style="margin-top:.75rem;">Hunny Pot</div>');
  parts.push(`<div class="hint">Before: ${summary.potBefore} · After: ${summary.potAfter}</div>`);

  if (!parts.length) parts.push('<div class="hint">No adjustments this round.</div>');

  els.adjustmentsBody.innerHTML = parts.join('');
  els.adjustmentsBackdrop.style.display = 'flex';
  render();
}

els.adjustmentsClose?.addEventListener('click', () => {
  els.adjustmentsBackdrop.style.display = 'none';
});
els.adjustmentsBackdrop?.addEventListener('click', e => {
  if (e.target === els.adjustmentsBackdrop)
    els.adjustmentsBackdrop.style.display = 'none';
});


// ============================================================
// EVENT DELEGATION — SETUP & HISTORY LISTS
// ============================================================

els.playersList?.addEventListener('click', e => {
  const btn      = e.target.closest('[data-action]');
  if (!btn) return;
  const action   = btn.dataset.action;
  const playerId = btn.dataset.playerId;
  if (action === 'add-to-pot')    openAddToPotModal();
  if (action === 'clear-pot')     openClearPotModal();
  if (action === 'give-from-pot') openGiveFromPotModal(playerId);
  if (action === 'remove-player') { removePlayer(playerId); render(); }
});

els.historyList?.addEventListener('click', e => {
  const btn    = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const betId  = btn.dataset.betId;
  if (action === 'reuse-question') reuseQuestion(betId);
});

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
// ATTRACTION AUTOCOMPLETE
// ============================================================

function setupAttractionSuggestions() {
  if (!window.PARKS) return;
  const attractions = window.PARKS.attractions || [];

  const dlAttractions = document.getElementById('attractionSuggestions');
  if (dlAttractions) {
    dlAttractions.innerHTML = attractions
      .map(a => `<option value="${a.name.replace(/"/g, '&quot;')}"></option>`)
      .join('');
  }

  const dlLands = document.getElementById('landSuggestions');
  if (dlLands) {
    const lands = Array.from(new Set(attractions.map(a => a.land))).sort();
    dlLands.innerHTML = lands
      .map(land => `<option value="${land.replace(/"/g, '&quot;')}"></option>`)
      .join('');
  }

  function applyAttractionSelection() {
    const name  = els.attractionName.value.trim().toLowerCase();
    if (!name) return;
    const match = attractions.find(a => a.name.toLowerCase() === name);
    if (!match) return;
    if (match.land && !els.landName.value.trim()) els.landName.value = match.land;
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
// BUTTON WIRING
// ============================================================

document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
  const name   = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);
  if (!name)      return alertLike('Enter a family member name.');
  if (points < 0) return alertLike('Starting points must be 0 or more.');
  addPlayer(name, points);
  render();
  els.playerName.value   = '';
  els.playerPoints.value = '10';
});

els.playerName?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addPlayerBtn')?.click(); }
});

document.getElementById('createBetBtn')?.addEventListener('click', () => {
  if (state.players.length < 2) return alertLike('You need at least two family members to play.');
  const attraction = els.attractionName.value.trim();
  const land       = els.landName.value.trim();
  const question   = els.betDescription.value.trim();
  if (!attraction || !land || !question) return alertLike('Attraction, Land, and Question are all required.');

  const launchRound = selection => {
    const bet = finalizeCreateBet({ attraction, land, question, ...selection });
    if (!bet) return;
    render();
    startAnswerPhaseUI(bet.id);
  };

  if (state.gameOptions?.hotRounds && state.pot > 10) {
    openHotRoundModal(launchRound);
  } else {
    launchRound({ hotRound: false, hotRoundBonus: 0 });
  }
});

document.getElementById('randomBetBtn')?.addEventListener('click', () => {
  const q = getRandomUnusedGlobalQuestion();
  if (!q) return alertLike('No question ideas available yet.');
  els.betDescription.value = q;
});

document.getElementById('clearBetFormBtn')?.addEventListener('click', () => resetQuestionForm());

document.getElementById('lockGuessesBtn')?.addEventListener('click', () => {
  const bet = getCurrentGuessingBet();
  if (!bet) return alertLike('No round is ready for guessing right now.');

  const rawGuesses = buildRawGuessesForBet();
  const guesses    = normalizeGuesses(rawGuesses);
  if (!guesses)    return alertLike('At least one player must place a wager.');

  const tableCheck = validateTableStakes(guesses);
  if (!tableCheck.ok) return alertLike(tableCheck.message);

  bet.guesses = guesses;
  saveState();

  const result = resolveGuessingBet(bet.id);
  if (!result) return alertLike('Could not resolve this round. Check the wager screen.');

  lastResolvedBetId = bet.id;
  renderSimpleReveal(result);
  render();
  goToReveal();
});

document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  state.players        = [];
  state.bets           = [];
  state.pot            = 0;
  state.awardedBonuses = [];
  saveState();
  render();
  goToSetup();
});

document.getElementById('startGameBtn')?.addEventListener('click', () => {
  if (state.players.length < 2) return alertLike('Add at least two family members first.');
  resetQuestionForm();
  goToQuestion();
});

// Navigation
document.getElementById('toScoresBtn')?.addEventListener('click',       () => goToScores());
document.getElementById('nextRoundBtn')?.addEventListener('click',      () => { resetQuestionForm(); goToQuestion(); });
document.getElementById('viewHistoryBtn')?.addEventListener('click',    () => { render(); goToHistory(); });
document.getElementById('scoresBackToSetupBtn')?.addEventListener('click', () => goToSetup());
document.getElementById('historyBackToScoresBtn')?.addEventListener('click', () => goToScores());
document.getElementById('restartGameBtn')?.addEventListener('click',    () => { resetGameKeepingPlayers(); render(); goToSetup(); });
document.getElementById('viewAdjustmentsBtn')?.addEventListener('click',() => openAdjustmentsModal());

els.revealCloseBtn?.addEventListener('click', () => {
  els.revealBackdrop.style.display = 'none';
});
els.revealBackdrop?.addEventListener('click', e => {
  if (e.target === els.revealBackdrop) els.revealBackdrop.style.display = 'none';
});


// ============================================================
// BOOTSTRAP
// ============================================================

window.addEventListener('load', () => {
  loadState();
  const potChanged = enforceMinPot();
  if (potChanged) saveState();
  initTheme();
  syncModeUIFromState();
  setupAttractionSuggestions();
  render();
  goToSetup();
  els.playerName?.focus();
});
