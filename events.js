// events.js
// Wire up DOM events and kick off the app.

import { state, loadState, enforceMinPot, saveState } from './state.js';
import { els, navEls, goToSetup, goToQuestion, goToScores, goToHistory } from './dom.js';
import { render } from './render.js';
import { addPlayer } from './players.js';
import { createBet, getCurrentGuessingBet, buildGuessesForBet, resolveGuessingBet,
         getRandomUnusedGlobalQuestion } from './bets.js';
import { alertLike } from './state.js';
import { giveFromPot, addToPot, clearPot } from './players.js';
import { setupAttractionSuggestions } from './suggestions.js'; // if you split that logic

// Clear the question form fields.
function resetQuestionForm() {
  els.attractionName.value = '';
  els.landName.value = '';
  els.betDescription.value = '';
}

// Player events
document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const points = Number(els.playerPoints.value || 0);

  if (!name) return alertLike('Enter a family member name.');
  if (points < 0) return alertLike('Starting points must be 0 or more.');

  addPlayer(name, points);
  els.playerName.value = '';
  els.playerPoints.value = 10;
});

els.playerName?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addPlayerBtn')?.click();
  }
});

// Question creation
document.getElementById('createBetBtn')?.addEventListener('click', () => {
  createBet();
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

// Lock guesses and resolve
document.getElementById('lockGuessesBtn')?.addEventListener('click', () => {
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

// Global clear/reset
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

// App bootstrap
window.addEventListener('load', () => {
  loadState();
  enforceMinPot();
  render();
  setupAttractionSuggestions();
  goToSetup();
  els.playerName?.focus();
});
