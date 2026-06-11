// dom.js
// All element lookups and basic screen navigation in one place.

export const els = {
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

  // Answer modal
  answerBackdrop: document.getElementById('answerModalBackdrop'),
  answerPrompt: document.getElementById('answerModalPrompt'),
  answerPlayerLabel: document.getElementById('answerModalPlayerLabel'),
  answerInput: document.getElementById('answerModalInput'),
  answerSaveBtn: document.getElementById('answerModalSaveBtn'),
  answerCancelBtn: document.getElementById('answerModalCancelBtn'),
  answerGhostBtn: document.getElementById('answerModalGhostBtn'),

  // Reveal modal
  revealBackdrop: document.getElementById('revealModalBackdrop'),
  revealTitle: document.getElementById('revealModalTitle'),
  revealSub: document.getElementById('revealModalSub'),
  revealBody: document.getElementById('revealModalBody'),
  revealCloseBtn: document.getElementById('revealModalCloseBtn'),

  // Hunny Pot modals
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

// Simple screen routing using a shared CSS class.
const screenIds = ['setup', 'question', 'wager', 'reveal', 'scores', 'history'];
const screens = {};
screenIds.forEach(id => {
  screens[id] = document.getElementById(`screen-${id}`);
});

export const navEls = {
  startGameBtn: document.getElementById('startGameBtn'),
  toScoresBtn: document.getElementById('toScoresBtn'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  viewHistoryBtn: document.getElementById('viewHistoryBtn'),
  backToScoresBtn: document.getElementById('backToScoresBtn'),
  restartGameBtn: document.getElementById('restartGameBtn')
};

export function showScreen(id) {
  screenIds.forEach(name => {
    const el = screens[name];
    if (!el) return;
    el.classList.toggle('screen--active', name === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function goToSetup() { showScreen('setup'); }
export function goToQuestion() { showScreen('question'); }
export function goToWager() { showScreen('wager'); }
export function goToReveal() { showScreen('reveal'); }
export function goToScores() { showScreen('scores'); }
export function goToHistory() { showScreen('history'); }

// Answer modal helpers
export function showAnswerModal() {
  els.answerBackdrop.style.display = 'flex';
}

export function hideAnswerModal() {
  els.answerBackdrop.style.display = 'none';
}
