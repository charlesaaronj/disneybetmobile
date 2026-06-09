// === Who Said Diz with bonus panel ===

// ---------- State ----------
const state = {
  players: [],
  bets: [],
  pot: 0,

  // Built‑in bonus rules (manual award via buttons)
  bonuses: [
    {
      id: 'noGuessAuthor',
      name: 'No one guessed the author',
      points: 3, // updated from 1 to 3
      active: true,
      description: 'If nobody guesses correctly, the real author gets +3 points.'
    },
    {
      id: 'streak3',
      name: '3 wins in a row',
      points: 3,
      active: true,
      description: 'Award when a player has won 3 resolved rounds in a row.'
    },
    {
      id: 'multiLand',
      name: 'Multiple wins in a single land',
      points: 2,
      active: true,
      description: 'Award when a player has multiple wins in the same land.'
    }
  ],
  awardedBonuses: []
};

const STORAGE_KEY = 'disney-line-bet-v1';

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
  answerGhostBtn: document.getElementById('answerGhostBtn'), // NEW

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

  // Bonus-related panels
  qualifiedBonusPanel: document.getElementById('qualifiedBonusPanel'),
  bonusLibrary: document.getElementById('bonusLibrary')
};

// ---------- Small helpers ----------
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function clampScore(x) {
  return Math.max(0, Math.round(x));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}
function alertLike(message) {
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    zIndex: 999,
    padding: '10px 14px',
    borderRadius: '999px',
    background: '#000',
    color: '#fff',
    maxWidth: '90vw',
    textAlign: 'center'
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Fisher–Yates shuffle
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;
    state.players = parsed.players;
    state.bets = parsed.bets;
    state.pot = Number(parsed.pot) || 0;
    state.bonuses = parsed.bonuses || state.bonuses || [];
    state.awardedBonuses = parsed.awardedBonuses || [];
  } catch {}
}

function getAvailablePoints(playerId) {
  const p = state.players.find(x => x.id === playerId);
  return p ? clampScore(p.currentPoints) : 0;
}
function getPlayerName(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

// ---------- Players ----------
function addPlayer(name, startingPoints) {
  state.players.push({
    id: uid(),
    name: name.trim(),
    startingPoints: clampScore(startingPoints),
    currentPoints: clampScore(startingPoints)
  });
  saveState();
  render();
}

function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  state.bets = state.bets.filter(
    bet => !bet.guesses?.some(g => g.playerId === playerId)
  );
  saveState();
  render();
}

// ---------- Hunny Pot ----------
function giveFromPot(playerId) {
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
    player.currentPoints = clampScore(player.currentPoints + amount);
    saveState();
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

function addToPot() {
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
    saveState();
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

function clearPot() {
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
    saveState();
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

window.addToPot = addToPot;
window.clearPot = clearPot;
window.giveFromPot = giveFromPot;
window.removePlayer = removePlayer;

// ---------- Bets / guessing ----------
function getCurrentGuessingBet() {
  return state.bets.find(b => b.status === 'guessing') || null;
}

function createBet() {
  if (!state.players.length) {
    alertLike('Add family members before starting a round.');
    return;
  }

  const attraction = els.attractionName.value.trim();
  const land = els.landName.value.trim();
  const question = els.betDescription.value.trim();

  if (!attraction || !land || !question) {
    alertLike('Attraction, Land, and Question are all required.');
    return;
  }

  const betId = uid();
  const nextIndex = state.bets.length
    ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
    : 1;

  const bet = {
    id: betId,
    index: nextIndex,
    description: question,
    createdAt: new Date().toLocaleString(),
    attraction,
    land,
    status: 'answering',
    answers: [],
    chosenAnswerId: null,
    correctAuthorId: null,
    correctAuthors: [],
    guesses: [],
    roundWinners: [],
    bonusAwards: [],
    answerOrder: shuffle(state.players.map(p => p.id)),
    wagerOrder: []
  };

  state.bets.unshift(bet);
  els.betDescription.value = '';
  saveState();
  render();
  startAnswerPhase(betId);
}

// ---------- Answer collection ----------
let currentAnswerBetId = null;
let currentAnswerIndex = 0;

function showAnswerModal() {
  els.answerBackdrop.style.display = 'flex';
}
function hideAnswerModal() {
  els.answerBackdrop.style.display = 'none';
}

function startAnswerPhase(betId) {
  currentAnswerBetId = betId;
  currentAnswerIndex = 0;
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
  bet.answers = [];
  bet.status = 'answering';
  if (!Array.isArray(bet.answerOrder) || !bet.answerOrder.length) {
    bet.answerOrder = shuffle(state.players.map(p => p.id));
  }
  saveState();
  nextAnswerPrompt();
}

function nextAnswerPrompt() {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  if (currentAnswerIndex >= order.length) {
    bet.status = 'guessing';

    if (!bet.chosenAnswerId && bet.answers.length) {
      const idx = Math.floor(Math.random() * bet.answers.length);
      const chosen = bet.answers[idx];
      bet.chosenAnswerId = chosen.id;

      const sameTextAuthors = bet.answers
        .filter(a => a.text === chosen.text)
        .map(a => a.playerId);

      bet.correctAuthors = sameTextAuthors;
      bet.correctAuthorId = sameTextAuthors[0] || null;
    }

    bet.wagerOrder = shuffle(state.players.map(p => p.id));
    saveState();
    hideAnswerModal();
    render();
    return;
  }

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    currentAnswerIndex += 1;
    nextAnswerPrompt();
    return;
  }

  const metaParts = [];
  if (bet.attraction) metaParts.push(bet.attraction);
  if (bet.land) metaParts.push(bet.land);
  const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';

  els.answerPrompt.textContent =
    `Hand the phone to ${player.name}. Only they should see this screen.\n\nQuestion: ${bet.description} ${meta}`;

  els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
  els.answerInput.value = '';
  showAnswerModal();
}

els.answerSaveBtn.addEventListener('click', () => {
  const bet = state.bets.find(b => b.id === currentAnswerBetId);
  if (!bet) return;

  const order = Array.isArray(bet.answerOrder) && bet.answerOrder.length
    ? bet.answerOrder
    : state.players.map(p => p.id);

  const playerId = order[currentAnswerIndex];
  const player = state.players.find(p => p.id === playerId);
  const text = els.answerInput.value.trim();

  if (!text) {
    alertLike('Type an answer before saving.');
    return;
  }

  if (!player) {
    currentAnswerIndex += 1;
    nextAnswerPrompt();
    return;
  }

  bet.answers.push({ id: uid(), playerId: player.id, text });
  saveState();
  currentAnswerIndex += 1;
  nextAnswerPrompt();
});

// Cancel button for answer modal
if (els.answerCancelBtn) {
  els.answerCancelBtn.addEventListener('click', () => {
    hideAnswerModal();
  });
}

// NEW: Ghost fragment button in answer modal
if (els.answerGhostBtn) {
  els.answerGhostBtn.addEventListener('click', () => {
    if (typeof getRandomRideFragment === 'function') {
      const text = getRandomRideFragment();
      els.answerInput.value = text;
    } else {
      alertLike('No ride fragments are available right now.');
    }
  });
}

// ---------- Guessing & wagering ----------
// ... (rest of your file continues unchanged)
