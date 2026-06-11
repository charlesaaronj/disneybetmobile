// players.js
// Player management and Hunny Pot transfer flows.

import {
  state,
  clampScore,
  uid,
  enforceMinPot,
  saveState,
  alertLike
} from './state.js';
import { els } from './dom.js';
import { render } from './render.js';

// Add a new player to the game with a starting score.
export function addPlayer(name, startingPoints) {
  state.players.push({
    id: uid(),
    name: name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints: clampScore(startingPoints)
  });

  enforceMinPot();
  saveState();
  render();
}

// Remove a player and any guesses that reference them.
export function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  state.bets = state.bets.filter(
    bet => !bet.guesses?.some(g => g.playerId === playerId)
  );

  enforceMinPot();
  saveState();
  render();
}

// Show "give from pot" modal and move points from pot → player.
export function giveFromPot(playerId) {
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
    let amount = Number(els.giveHunnyInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alertLike('Enter a number greater than 0.');
      return;
    }
    if (amount > max) amount = max;

    state.pot -= amount;
    enforceMinPot();
    player.currentPoints = clampScore(player.currentPoints + amount);
    saveState();
    render();
    close();
  };

  const onCancel = () => close();

  els.giveHunnyConfirm.addEventListener('click', onConfirm);
  els.giveHunnyCancel.addEventListener('click', onCancel);

  els.giveHunnyBackdrop.style.display = 'flex';
  els.giveHunnyInput.focus();
}

// Open "add to pot" modal and move points from nowhere → pot.
export function addToPot() {
  els.addHunnyInput.value = '5';
  els.addHunnyInput.min = '1';

  const close = () => {
    els.addHunnyBackdrop.style.display = 'none';
    els.addHunnyConfirm.removeEventListener('click', onConfirm);
    els.addHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    let amount = Number(els.addHunnyInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alertLike('Enter a number greater than 0.');
      return;
    }
    state.pot += amount;
    enforceMinPot();
    saveState();
    render();
    close();
  };

  const onCancel = () => close();

  els.addHunnyConfirm.addEventListener('click', onConfirm);
  els.addHunnyCancel.addEventListener('click', onCancel);

  els.addHunnyBackdrop.style.display = 'flex';
  els.addHunnyInput.focus();
}

// Confirm and reset the Hunny Pot to zero.
export function clearPot() {
  if (!state.pot) return;

  els.clearHunnyMessage.textContent =
    `Clear the Hunny Pot (${state.pot} points)?`;

  const close = () => {
    els.clearHunnyBackdrop.style.display = 'none';
    els.clearHunnyConfirm.removeEventListener('click', onConfirm);
    els.clearHunnyCancel.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    state.pot = 0;
    enforceMinPot();
    saveState();
    render();
    close();
  };

  const onCancel = () => close();

  els.clearHunnyConfirm.addEventListener('click', onConfirm);
  els.clearHunnyCancel.addEventListener('click', onCancel);

  els.clearHunnyBackdrop.style.display = 'flex';
}

// Optional: expose for inline onclick="" handlers if you keep them.
window.addToPot = addToPot;
window.clearPot = clearPot;
window.giveFromPot = giveFromPot;
window.removePlayer = removePlayer;
