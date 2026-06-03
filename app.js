<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Disney Line Guess</title>

  <link rel="preconnect" href="https://api.fontshare.com" />
  <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700&f[]=satoshi@400,500,700&display=swap" rel="stylesheet" />

  <style>
    :root, [data-theme="light"] {
      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.25rem;
      --text-xl: 1.75rem;

      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-6: 1.5rem;

      --color-bg: #f7f6f2;
      --color-surface: #f9f8f5;
      --color-surface-2: #fbfbf9;
      --color-border: #d4d1ca;

      --color-text: #28251d;
      --color-text-muted: #6f6d67;
      --color-text-inverse: #f9f8f4;

      --color-primary: #01696f;
      --color-primary-hover: #0c4e54;
      --color-success: #437a22;
      --color-warning: #964219;
      --color-error: #a12c7b;
      --color-gold: #d4a017;

      --radius-md: 0.8rem;
      --radius-lg: 1.1rem;
      --radius-full: 9999px;

      --shadow-sm: 0 1px 2px rgba(40,37,29,.06);
      --shadow-md: 0 8px 24px rgba(40,37,29,.09);

      --font-display: 'Cabinet Grotesk', 'Inter', sans-serif;
      --font-body: 'Satoshi', 'Inter', sans-serif;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: none; text-size-adjust: none; scroll-behavior: smooth; }

    body {
      min-height: 100dvh;
      font-family: var(--font-body);
      font-size: var(--text-base);
      line-height: 1.5;
      color: var(--color-text);
      background: var(--color-bg);
    }

    button, input, textarea, select { font: inherit; color: inherit; }
    button { cursor: pointer; border: none; background: none; }

    input, textarea, select {
      width: 100%;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      padding: 0.6rem 0.75rem;
    }
    textarea { min-height: 80px; resize: vertical; }

    :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

    .app { max-width: 1100px; margin: 0 auto; padding: var(--space-4); }

    .topbar {
      display: flex; gap: var(--space-3); align-items: center; justify-content: space-between;
      margin-bottom: var(--space-4); padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .brand { display: flex; gap: var(--space-3); align-items: center; }
    .logo { width: 40px; height: 40px; color: var(--color-primary); }

    h1, h2, h3 { font-family: var(--font-display); line-height: 1.1; }
    h1 { font-size: var(--text-xl); }
    h2 { font-size: var(--text-lg); margin-bottom: var(--space-3); }
    h3 { font-size: 1.1rem; }

    .sub { color: var(--color-text-muted); font-size: var(--text-sm); max-width: 40rem; }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
      min-height: 38px; padding: 0.5rem 0.85rem;
      border-radius: var(--radius-full); border: 1px solid transparent;
      font-weight: 600; font-size: var(--text-sm);
      transition: background-color 150ms ease, transform 150ms ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary { background: var(--color-primary); color: var(--color-text-inverse); }
    .btn-primary:hover { background: var(--color-primary-hover); }
    .btn-secondary { background: var(--color-surface-2); border-color: var(--color-border); }
    .btn-danger { background: #fce7f2; color: var(--color-error); border-color: #f3c3dd; }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
      gap: var(--space-4);
      align-items: flex-start;
    }

    .stack { display: grid; gap: var(--space-3); }

    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      box-shadow: var(--shadow-sm);
    }

    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }

    .field { display: grid; gap: .35rem; }
    .field label { font-size: var(--text-sm); font-weight: 600; }
    .hint { color: var(--color-text-muted); font-size: var(--text-xs); }

    .players { display: grid; gap: var(--space-3); }

    .player-chip,
    .score-card,
    .history-item,
    .player-bet-row {
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
    }

    .player-chip {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-3);
      padding: var(--space-3);
      align-items: center;
    }

    .scoreboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-3);
    }

    .score-card {
      padding: var(--space-3);
      display: grid;
      gap: 0.25rem;
    }

    .score-name { font-weight: 600; }
    .score-points { font-size: 1.4rem; font-weight: 700; color: var(--color-primary); }

    .pill {
      display: inline-flex; align-items: center;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .pill-open { background: #fff7df; color: var(--color-warning); }
    .pill-won { background: #e5f7e5; color: var(--color-success); }
    .pot-pill { background: #fff0c7; color: var(--color-warning); }

    .bet-list, .history-list { display: grid; gap: var(--space-3); }
    .bet-card, .history-item { padding: var(--space-3); display: grid; gap: var(--space-3); }

    .bet-head {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      align-items: flex-start;
    }
    .bet-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; }

    .player-bet-row {
      padding: 0.75rem;
      display: grid;
      grid-template-columns: 1.2fr 1.1fr 0.9fr;
      gap: var(--space-3);
      align-items: center;
    }

    .small-actions {
      display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center;
    }

    .empty {
      color: var(--color-text-muted);
      padding: var(--space-4);
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
    }

    .totals { display: flex; flex-wrap: wrap; gap: var(--space-3); }
    .metric { padding: var(--space-3); background: var(--color-surface-2); border-radius: var(--radius-md); min-width: 140px; }
    .metric-value { display: block; font-size: 1.1rem; font-weight: 700; }

    .footer-note { margin-top: var(--space-3); font-size: var(--text-xs); color: var(--color-text-muted); }

    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      box-shadow: var(--shadow-md);
      max-width: 400px;
      width: calc(100vw - 2rem);
      display: grid;
      gap: var(--space-3);
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap;
    }

    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .bet-head { flex-direction: column; }
      .topbar { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <a class="sr-only" href="#main">Skip to content</a>

  <div class="app">
    <header class="topbar">
      <div class="brand">
        <svg class="logo" viewBox="0 0 64 64" fill="none" aria-label="Disney Line Guess logo">
          <path d="M14 48c4-13 14-22 28-25-2 11-9 21-20 28" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          <circle cx="22" cy="20" r="6" stroke="currentColor" stroke-width="4" />
          <circle cx="40" cy="16" r="5" stroke="currentColor" stroke-width="4" />
          <path d="M18 50h30" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        </svg>
        <div>
          <h1>Disney Line Guess</h1>
          <p class="sub">Everyone writes secret answers about the ride, then wagers points on who wrote which answer.</p>
        </div>
      </div>
    </header>

    <main id="main" class="layout">
      <section class="stack">
        <article class="panel">
          <h2>Scores</h2>
          <div id="scoreboard" class="scoreboard"></div>
        </article>

        <article class="panel">
          <h2>Family setup</h2>
          <div class="grid-2">
            <div class="field">
              <label for="playerName">Family member</label>
              <input id="playerName" type="text" placeholder="Add a name" />
            </div>
            <div class="field">
              <label for="playerPoints">Starting points</label>
              <input id="playerPoints" type="number" min="0" step="1" value="10" />
            </div>
          </div>
          <div class="small-actions" style="margin-top:1rem;">
            <button class="btn btn-primary" type="button" id="addPlayerBtn">Add family member</button>
            <button class="btn btn-danger" type="button" id="clearAllBtn">Clear everything</button>
          </div>
          <p class="footer-note">Use different starting points for kids, adults, or bonus rounds if you want handicaps.</p>
        </article>

        <article class="panel">
          <h2>Players</h2>
          <p class="hint" style="margin-bottom:.5rem;">
            Stuck at zero? Use the Hunny Pot to give someone a few points back so they can keep playing.
          </p>
          <div id="playersList" class="players"></div>
        </article>
      </section>

      <section class="stack">
        <article class="panel">
          <h2>Pick a question</h2>
          <div class="grid-2">
            <div class="field">
              <label for="attractionName">Attraction</label>
              <input id="attractionName" type="text" placeholder="e.g., Space Mountain" />
            </div>
            <div class="field">
              <label for="landName">Land / Area</label>
              <input id="landName" type="text" placeholder="e.g., Tomorrowland" />
            </div>
          </div>
          <div class="field" style="margin-top:1rem;">
            <label for="betDescription">Question about this ride</label>
            <textarea id="betDescription" placeholder="Type your own question. All three fields are required."></textarea>
          </div>
          <div class="small-actions" style="margin-top:.75rem;">
            <button class="btn btn-secondary" type="button" id="randomBetBtn">Random idea</button>
            <button class="btn btn-primary" type="button" id="createBetBtn">Start question round</button>
            <button class="btn btn-secondary" type="button" id="clearBetFormBtn">Clear</button>
          </div>
          <div id="starterHint" style="margin-top:.75rem;"></div>
          <div id="betPlayers" class="players" style="margin-top:.5rem;"></div>
          <div class="small-actions" style="margin-top:.75rem;">
            <button class="btn btn-primary" type="button" id="lockGuessesBtn">Lock guesses &amp; reveal</button>
          </div>
        </article>

        <article class="panel">
          <h2>Rounds</h2>
          <div id="openBetMetrics" class="totals"></div>
          <div id="openBets" class="bet-list" style="margin-top:1rem;"></div>
        </article>

        <article class="panel">
          <h2>Round history</h2>
          <div id="historyList" class="history-list"></div>
        </article>
      </section>
    </main>
  </div>

  <!-- Answer collection modal -->
  <div id="answerModalBackdrop" class="modal-backdrop" style="display:none;">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="answerModalTitle">
      <h3 id="answerModalTitle" class="modal-title">Pass the phone</h3>
      <p class="hint" id="answerModalPrompt"></p>
      <div class="field" style="margin-top:.75rem;">
        <label id="answerModalPlayerLabel"></label>
        <textarea id="answerModalInput"></textarea>
      </div>
      <div class="small-actions" style="justify-content:flex-end;">
        <button type="button" class="btn btn-primary" id="answerModalSaveBtn">Save and pass</button>
      </div>
    </div>
  </div>

  <!-- Reveal modal -->
  <div id="revealModalBackdrop" class="modal-backdrop" style="display:none;">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="revealModalTitle">
      <h3 id="revealModalTitle" class="modal-title">Round result</h3>
      <p class="hint" id="revealModalSub"></p>
      <div class="field" style="margin-top:.75rem;">
        <div id="revealModalBody" class="hint"></div>
      </div>
      <div class="small-actions" style="justify-content:flex-end;">
        <button type="button" class="btn btn-primary" id="revealModalCloseBtn">OK</button>
      </div>
    </div>
  </div>

  <script>
    // --------- Preset questions ---------
    const presetBets = [
      "What do you think will be your favorite moment on this ride?",
      "What 3 words will you say when this ride ends?",
      "What will surprise you most about this ride?",
      "What part of the ride will make you laugh?",
      "What part of the ride will be the scariest?",
      "What is one thing you think you will notice that no one else will?",
      "Describe this ride in 3 silly words you haven't used before."
    ];
    function getRandomPresetBet() {
      if (!presetBets.length) return null;
      const index = Math.floor(Math.random() * presetBets.length);
      return presetBets[index];
    }

    // --------- State ---------
    const state = { players: [], bets: [], pot: 0 };
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
      starterHint: document.getElementById('starterHint'),
      openBets: document.getElementById('openBets'),
      historyList: document.getElementById('historyList'),
      openBetMetrics: document.getElementById('openBetMetrics'),
      answerBackdrop: document.getElementById('answerModalBackdrop'),
      answerPrompt: document.getElementById('answerModalPrompt'),
      answerPlayerLabel: document.getElementById('answerModalPlayerLabel'),
      answerInput: document.getElementById('answerModalInput'),
      answerSaveBtn: document.getElementById('answerModalSaveBtn'),
      revealBackdrop: document.getElementById('revealModalBackdrop'),
      revealTitle: document.getElementById('revealModalTitle'),
      revealSub: document.getElementById('revealModalSub'),
      revealBody: document.getElementById('revealModalBody'),
      revealCloseBtn: document.getElementById('revealModalCloseBtn')
    };

    function uid() {
      return Math.random().toString(36).slice(2, 10);
    }
    function clampScore(x) {
      return Math.max(0, Math.round(x));
    }

    function saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.players) || !Array.isArray(parsed.bets)) return;
        state.players = parsed.players;
        state.bets = parsed.bets.map(b => ({
          ...b,
          guesses: b.guesses || [],
          answers: b.answers || []
        }));
        state.pot = Number(parsed.pot) || 0;
        render();
      } catch {}
    }

    // --------- Helpers ---------
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
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

    function getAvailablePoints(playerId) {
      const player = state.players.find(p => p.id === playerId);
      return player ? clampScore(player.currentPoints) : 0;
    }

    function getBetOutcome(bet) {
      const correctAuthors = (bet.correctAuthors && bet.correctAuthors.length
        ? bet.correctAuthors
        : (bet.correctAuthorId ? [bet.correctAuthorId] : [])) || [];
      const guesses = bet.guesses || [];
      const wagers = guesses.map(g => ({
        playerId: g.playerId,
        guessedAuthorId: g.guessedAuthorId,
        wager: Math.max(0, Number(g.wager || 0))
      }));
      const potThisRound = wagers.reduce((sum, w) => sum + w.wager, 0);
      const winners = wagers.filter(
        w => w.wager > 0 && correctAuthors.includes(w.guessedAuthorId)
      );
      const anyCorrect = winners.length > 0;
      return { correctAuthors, wagers, winners, anyCorrect, potThisRound };
    }

    // No land streak bonuses in this simplified version
    function hasPreviousCorrectInSameLand() { return false; }

    // --------- Players ---------
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

    // --------- Hunny Pot ---------
    function giveFromPot(playerId) {
      const player = state.players.find(p => p.id === playerId);
      if (!player) return;
      if (state.pot <= 0) {
        alertLike('No points in the Hunny Pot right now.');
        return;
      }
      const max = state.pot;
      const amountStr = prompt(
        `How many points do you want to give to ${player.name} from the Hunny Pot? (Max ${max})`,
        String(Math.min(3, max))
      );
      if (amountStr === null) return;
      let amount = Number(amountStr);
      if (!Number.isFinite(amount) || amount <= 0) return;
      if (amount > max) amount = max;
      state.pot -= amount;
      player.currentPoints = clampScore(player.currentPoints + amount);
      saveState();
      render();
    }

    function addToPot() {
      const current = state.pot;
      const input = prompt(
        `How many points do you want to add to the Hunny Pot? (Current: ${current})`,
        '5'
      );
      if (input === null) return;
      let amount = Number(input);
      if (!Number.isFinite(amount) || amount <= 0) {
        alertLike('Enter a number greater than 0.');
        return;
      }
      state.pot += amount;
      saveState();
      render();
    }

    function clearPot() {
      if (!state.pot) return;
      const ok = confirm(`Clear the Hunny Pot (${state.pot} points)?`);
      if (!ok) return;
      state.pot = 0;
      saveState();
      render();
    }

    // --------- Answer flow ---------
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
      saveState();
      nextAnswerPrompt();
    }

    function nextAnswerPrompt() {
      const bet = state.bets.find(b => b.id === currentAnswerBetId);
      if (!bet) return;
      const players = state.players;
      if (currentAnswerIndex >= players.length) {
        bet.status = 'guessing';
        saveState();
        hideAnswerModal();
        render();
        startGuessPhase(bet.id);
        return;
      }
      const player = players[currentAnswerIndex];
      els.answerPrompt.textContent = `Hand the phone to ${player.name}. Only they should see this screen.`;
      els.answerPlayerLabel.textContent = `${player.name}, type your answer`;
      els.answerInput.value = '';
      showAnswerModal();
    }

    els.answerSaveBtn.addEventListener('click', () => {
      const bet = state.bets.find(b => b.id === currentAnswerBetId);
      if (!bet) return;
      const players = state.players;
      const player = players[currentAnswerIndex];
      const text = els.answerInput.value.trim();
      if (!text) {
        alertLike('Type an answer before saving.');
        return;
      }
      bet.answers.push({ id: uid(), playerId: player.id, text });
      saveState();
      currentAnswerIndex += 1;
      nextAnswerPrompt();
    });

    // --------- Bets / guessing ---------
    function createBet() {
      if (!state.players.length) {
        alertLike('Add family members before starting a round.');
        return;
      }
      const attraction = els.attractionName.value.trim();
      const land = els.landName.value.trim();
      let question = els.betDescription.value.trim();
      if (!attraction || !land || !question) {
        alertLike('Attraction, Land, and Question are all required.');
        return;
      }
      const betId = uid();
      const nextIndex = state.bets.length
        ? Math.max(0, ...state.bets.map(b => b.index ?? 0)) + 1
        : 1;
      const newBet = {
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
        guesses: []
      };
      state.bets.unshift(newBet);
      els.betDescription.value = '';
      els.starterHint.textContent = '';
      saveState();
      render();
      startAnswerPhase(betId);
    }

    function getCurrentGuessingBet() {
      return state.bets.find(b => b.status === 'guessing') || null;
    }

    function startGuessPhase(betId) {
      const bet = state.bets.find(b => b.id === betId);
      if (!bet) return;
      if (!bet.chosenAnswerId && bet.answers && bet.answers.length) {
        const idx = Math.floor(Math.random() * bet.answers.length);
        const chosen = bet.answers[idx];
        bet.chosenAnswerId = chosen.id;
        const sameTextAuthors = bet.answers
          .filter(a => a.text === chosen.text)
          .map(a => a.playerId);
        bet.correctAuthors = sameTextAuthors;
        bet.correctAuthorId = sameTextAuthors[0] || null;
        saveState();
      }
      renderGuessingRound(bet);
    }

    function renderGuessingRound(bet) {
      if (!bet) {
        els.starterHint.textContent = '';
        renderBetRows();
        return;
      }
      const chosen = bet.answers.find(a => a.id === bet.chosenAnswerId);
      const answerText = chosen ? chosen.text : '';
      const metaParts = [];
      if (bet.attraction) metaParts.push(bet.attraction);
      if (bet.land) metaParts.push(bet.land);
      const meta = metaParts.length ? `(${metaParts.join(' • ')})` : '';
      els.starterHint.textContent = `Answer to guess ${meta ? meta + ' ' : ''}${answerText}`;
      renderBetRows();
    }

    function renderBetRows() {
      if (!state.players.length) {
        els.betPlayers.innerHTML = '<div class="empty">Add players, then start a round.</div>';
        return;
      }
      const guessingBet = getCurrentGuessingBet();
      els.betPlayers.innerHTML = state.players.map(player => {
        const available = getAvailablePoints(player.id);
        return `
          <div class="player-bet-row" data-bet-player-row data-player-id="${player.id}">
            <div>
              <strong>${escapeHtml(player.name)}</strong>
              <div class="hint">Available ${available} points</div>
            </div>
            <div class="field">
              <label>Who wrote it?</label>
              <select data-guess-player ${guessingBet ? '' : 'disabled'}>
                ${
                  guessingBet
                    ? state.players.map(
                        p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`
                      ).join('')
                    : ''
                }
              </select>
            </div>
            <div class="field">
              <label>Wager</label>
              <input data-amount type="number" min="0" step="1" value="0" placeholder="0" ${
                guessingBet ? '' : 'disabled'
              } />
            </div>
          </div>
        `;
      }).join('');
      attachWagerGuards();
    }

    function buildGuessesForBet(bet) {
      const rows = [...document.querySelectorAll('[data-bet-player-row]')];
      const guesses = rows.map(row => {
        const playerId = row.dataset.playerId;
        const select = row.querySelector('[data-guess-player]');
        const input = row.querySelector('[data-amount]');
        const guessedAuthorId = select ? select.value : null;
        let wager = Number(input ? input.value : 0) || 0;
        if (!Number.isFinite(wager) || wager < 0) wager = 0;
        const available = getAvailablePoints(playerId);
        if (wager > available) wager = available;
        return { playerId, guessedAuthorId, wager };
      });
      const active = guesses.filter(g => g.wager > 0);
      if (!active.length) {
        alertLike('At least one player must wager points.');
        return null;
      }
      for (const g of active) {
        const available = getAvailablePoints(g.playerId);
        if (g.wager > available) {
          const player = state.players.find(p => p.id === g.playerId);
          alertLike(`${player?.name || 'This player'} only has ${available} available points.`);
          return null;
        }
      }
      return guesses;
    }

    // --------- Resolve ---------
    function showRevealModal(title, sub, bodyHtml) {
      els.revealTitle.textContent = title;
      els.revealSub.textContent = sub;
      els.revealBody.innerHTML = bodyHtml;
      els.revealBackdrop.style.display = 'flex';
    }
    els.revealCloseBtn.addEventListener('click', () => {
      els.revealBackdrop.style.display = 'none';
    });

    function resolveGuessingBet(betId) {
      const bet = state.bets.find(b => b.id === betId);
      if (!bet) return;

      const { correctAuthors, wagers, winners, anyCorrect, potThisRound } = getBetOutcome(bet);
      if (!correctAuthors.length) {
        alertLike('No answer was chosen to guess.');
        return;
      }

      // Apply scoring ON TOP of currentPoints (Hunny Pot gifts are preserved)
      const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

      // Subtract wagers
      wagers.forEach(w => {
        const player = playerMap[w.playerId];
        if (!player || w.wager <= 0) return;
        player.currentPoints = clampScore(player.currentPoints - w.wager);
      });

      // Distribute pot or send to Hunny Pot
      const totalWinnerWager = winners.reduce((s, w) => s + w.wager, 0);
      if (anyCorrect && potThisRound > 0 && totalWinnerWager > 0) {
        winners.forEach(w => {
          const player = playerMap[w.playerId];
          if (!player) return;
          const share = (potThisRound * w.wager) / totalWinnerWager;
          player.currentPoints = clampScore(player.currentPoints + share);
        });
      } else if (!anyCorrect && potThisRound > 0) {
        state.pot += potThisRound;
      }

      bet.status = 'resolved';
      bet.resolvedAt = new Date().toLocaleString();
      saveState();
      render();

      // Reveal content
      const authorNames = correctAuthors
        .map(id => {
          const p = state.players.find(pl => pl.id === id);
          return p ? p.name : null;
        }).filter(Boolean);

      const winnerLines = winners.map(w => {
        const player = state.players.find(p => p.id === w.playerId);
        return player ? `${player.name} (wagered ${w.wager})` : null;
      }).filter(Boolean);

      const parts = [];
      parts.push(`<div class="reveal-section-title">Author${authorNames.length > 1 ? 's' : ''}</div>`);
      parts.push(`<div>${escapeHtml(authorNames.join(', ') || 'Unknown')}</div>`);
      if (bet.attraction || bet.land) {
        parts.push(`<div class="hint">Attraction: ${escapeHtml(bet.attraction || 'Unknown')} ${bet.land ? '(' + escapeHtml(bet.land) + ')' : ''}</div>`);
      }
      parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Winners</div>`);
      if (anyCorrect && winnerLines.length) {
        parts.push(`<div>${winnerLines.map(escapeHtml).join('<br>')}</div>`);
      } else if (potThisRound > 0) {
        parts.push(`<div>No one guessed correctly. All wagers went to the Hunny Pot.</div>`);
      } else {
        parts.push(`<div>No one placed a wager this round.</div>`);
      }

      const ranked = [...state.players].sort((a, b) => a.currentPoints - b.currentPoints).reverse();
      parts.push(`<div class="reveal-section-title" style="margin-top:.75rem;">Scores after this round</div>`);
      parts.push(`<div>${ranked.map(p => `${escapeHtml(p.name)}: ${clampScore(p.currentPoints)}`).join('<br>')}</div>`);
      parts.push(`<div class="hint" style="margin-top:.75rem;">Hunny Pot is now ${state.pot} points.</div>`);

      showRevealModal('Round result', 'Here is who wrote the answer and how the points changed.', parts.join(''));
    }

    // --------- History ---------
    function renderHistory() {
      const resolved = state.bets.filter(b => b.status === 'resolved');
      if (!resolved.length) {
        els.historyList.innerHTML = '<div class="empty">Resolved rounds will stay here so you can reuse fun questions later.</div>';
        return;
      }
      els.historyList.innerHTML = resolved.map(bet => {
        const { correctAuthors, winners } = getBetOutcome(bet);
        const authorNames = correctAuthors
          .map(id => {
            const p = state.players.find(pl => pl.id === id);
            return p ? p.name : null;
          }).filter(Boolean);
        const winnerText = winners
          .map(w => {
            const player = state.players.find(p => p.id === w.playerId);
            return player ? `${player.name} (wagered ${w.wager})` : null;
          }).filter(Boolean);

        const metaParts = [];
        if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
        if (bet.land) metaParts.push(escapeHtml(bet.land));

        return `
          <article class="history-item">
            <div class="bet-head">
              <div>
                <h3>${escapeHtml(bet.description)}</h3>
                <div class="hint">Resolved ${escapeHtml(bet.resolvedAt || '')}</div>
              </div>
              <div class="bet-meta">
                <span class="pill pill-won">Round finished</span>
                ${
                  authorNames.length
                    ? `<span class="pill">Author: ${escapeHtml(authorNames.join(', '))}</span>`
                    : ''
                }
                ${metaParts.length ? `<span class="pill">${metaParts.join(' • ')}</span>` : ''}
              </div>
            </div>
            <div class="hint">
              Winners … ${winnerText.length ? escapeHtml(winnerText.join(', ')) : 'No winners'}
            </div>
          </article>
        `;
      }).join('');
    }

    // --------- Open rounds / metrics ---------
    function renderOpenMetrics() {
      const answering = state.bets.filter(b => b.status === 'answering').length;
      const guessing = state.bets.filter(b => b.status === 'guessing').length;
      const resolved = state.bets.filter(b => b.status === 'resolved').length;
      els.openBetMetrics.innerHTML = `
        <div class="metric">
          <span class="hint">Answering rounds</span>
          <span class="metric-value">${answering}</span>
        </div>
        <div class="metric">
          <span class="hint">Guessing rounds</span>
          <span class="metric-value">${guessing}</span>
        </div>
        <div class="metric">
          <span class="hint">Resolved rounds</span>
          <span class="metric-value">${resolved}</span>
        </div>
        <div class="metric">
          <span class="hint">Hunny Pot</span>
          <span class="metric-value">${state.pot}</span>
        </div>
      `;
    }

    function renderOpenBets() {
      const nonResolved = state.bets.filter(b => b.status !== 'resolved');
      if (!nonResolved.length) {
        els.openBets.innerHTML = '<div class="empty">No active rounds. Start a new question above.</div>';
        return;
      }
      els.openBets.innerHTML = nonResolved.map(bet => {
        const statusLabel = bet.status === 'answering'
          ? 'Collecting answers'
          : bet.status === 'guessing'
          ? 'Guessing & wagering'
          : 'Round';
        const metaParts = [];
        if (bet.attraction) metaParts.push(escapeHtml(bet.attraction));
        if (bet.land) metaParts.push(escapeHtml(bet.land));
        const metaText = metaParts.length ? metaParts.join(' • ') : '';
        return `
          <article class="bet-card">
            <div class="bet-head">
              <div>
                <h3>${escapeHtml(bet.description)}</h3>
                <div class="hint">Created ${escapeHtml(bet.createdAt || '')}</div>
              </div>
              <div class="bet-meta">
                <span class="pill pill-open">${statusLabel}</span>
                ${metaText ? `<span class="pill">${metaText}</span>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    // --------- Scores & players ---------
    function renderPlayers() {
      if (!state.players.length) {
        els.playersList.innerHTML = '<div class="empty">No family members yet. Add names above to begin.</div>';
        return;
      }
      const potHtml = `
        <div class="player-chip" style="margin-bottom:.5rem;">
          <div>
            <strong>Hunny Pot</strong>
            <div class="hint">Extra points you can give back to players.</div>
          </div>
          <div>
            <span class="pill pot-pill">Hunny Pot ${state.pot}</span>
            <div class="small-actions" style="margin-top:.25rem;">
              <button class="btn btn-secondary" type="button" onclick="addToPot()">Add to Hunny Pot</button>
              <button class="btn btn-danger" type="button" onclick="clearPot()">Clear Hunny Pot</button>
            </div>
          </div>
        </div>
      `;
      const playersHtml = state.players.map(player => {
        const canReceive = clampScore(player.currentPoints) === 0 && state.pot > 0;
        return `
          <div class="player-chip">
            <div>
              <strong>${escapeHtml(player.name)}</strong>
              <div class="hint">Starts with ${player.startingPoints} points</div>
            </div>
            <div>
              <div class="small-actions">
                <span class="pill pill-open">${clampScore(player.currentPoints)} now</span>
                ${
                  canReceive
                    ? `<button class="btn btn-secondary" type="button" onclick="giveFromPot('${player.id}')">Give from Hunny Pot</button>`
                    : ''
                }
                <button class="btn btn-danger" type="button" onclick="removePlayer('${player.id}')">Remove</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      els.playersList.innerHTML = potHtml + playersHtml;
    }

    function renderScoreboard() {
      if (!state.players.length) {
        els.scoreboard.innerHTML = '<div class="empty">Scores will appear here once players are added.</div>';
        return;
      }
      const ranked = [...state.players].sort((a, b) => b.currentPoints - a.currentPoints);
      els.scoreboard.innerHTML = ranked.map((player, index) => `
        <div class="score-card">
          <div class="hint">${index === 0 ? 'Leader' : 'Place ' + (index + 1)}</div>
          <div class="score-name">${escapeHtml(player.name)}</div>
          <div class="score-points">${clampScore(player.currentPoints)}</div>
          <div class="hint">Started with ${player.startingPoints}</div>
        </div>
      `).join('');
    }

    // --------- Wager guards ---------
    function attachWagerGuards() {
      const rows = [...document.querySelectorAll('[data-bet-player-row]')];
      rows.forEach(row => {
        const playerId = row.dataset.playerId;
        const input = row.querySelector('[data-amount]');
        if (!input) return;
        input.addEventListener('change', () => {
          const available = getAvailablePoints(playerId);
          let value = Number(input.value) || 0;
          if (!Number.isFinite(value) || value < 0) value = 0;
          if (value > available) {
            value = available;
            alertLike(`That's the max they can wager this round (${available} points).`);
          }
          input.value = value;
        }, { once: true });
      });
    }

    // --------- Render root ---------
    function render() {
      renderPlayers();
      renderScoreboard();
      renderBetPlayers();
      renderOpenMetrics();
      renderOpenBets();
      renderHistory();
    }

    // --------- Global functions for HTML onclick ---------
    window.addToPot = addToPot;
    window.clearPot = clearPot;
    window.giveFromPot = giveFromPot;
    window.removePlayer = removePlayer;

    // --------- Events ---------
    document.getElementById('addPlayerBtn').addEventListener('click', () => {
      const name = els.playerName.value.trim();
      const points = Number(els.playerPoints.value || 0);
      if (!name) return alertLike('Enter a family member name.');
      if (points < 0) return alertLike('Starting points must be 0 or more.');
      addPlayer(name, points);
      els.playerName.value = '';
      els.playerPoints.value = 10;
    });

    els.playerName.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addPlayerBtn').click();
      }
    });

    window.addEventListener('load', () => {
      els.playerName.focus();
      loadState();
    });

    document.getElementById('createBetBtn').addEventListener('click', createBet);

    document.getElementById('randomBetBtn').addEventListener('click', () => {
      const idea = getRandomPresetBet();
      if (!idea) return;
      els.betDescription.value = idea;
    });

    document.getElementById('clearBetFormBtn').addEventListener('click', () => {
      els.betDescription.value = '';
      els.attractionName.value = '';
      els.landName.value = '';
      els.starterHint.textContent = '';
      renderBetPlayers();
      attachWagerGuards();
    });

    document.getElementById('lockGuessesBtn').addEventListener('click', () => {
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

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      state.players = [];
      state.bets = [];
      state.pot = 0;
      saveState();
      render();
    });
  </script>
</body>
</html>
