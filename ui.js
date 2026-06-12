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
  rerollCurrentSelectedAnswer,
  validateTableStakes,
  resetGameKeepingPlayers
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

  revealSummary: document.getElementById('revealSummary'),

  // NEW: park select
  parkSelect: document.getElementById('parkSelect')
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

// ---------- Park theming ----------

function applyParkTheme() {
  const body = document.body;
  const park = state.park || '';

  body.classList.remove('park-mk', 'park-epcot', 'park-hs', 'park-dak');

  if (park === 'mk') body.classList.add('park-mk');
  else if (park === 'epcot') body.classList.add('park-epcot');
  else if (park === 'hs') body.classList.add('park-hs');
  else if (park === 'dak') body.classList.add('park-dak');
}

els.parkSelect?.addEventListener('change', () => {
  state.park = els.parkSelect.value || '';
  saveState();
  applyParkTheme();
});

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

// ... [everything in the middle of the file stays exactly as you have it now] ...

// ---------- Bootstrapping ----------

window.addEventListener('load', () => {
  loadState();
  enforceMinPot();

  // Initialize park selector + theme from saved state.
  if (els.parkSelect) {
    els.parkSelect.value = state.park || '';
  }
  applyParkTheme();

  render();
  setupAttractionSuggestions();
  goToSetup();
  els.playerName?.focus();
});
