// ============================================================
// RESOLVE — PHASE 1: WAGERS ONLY
// Authors never win or lose points on wagers for their own round.
// Their guesses are ignored for scoring purposes.
// ============================================================

export function resolveGuessingBet(betId) {
  console.log('--- resolveGuessingBet START ---');
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) {
    console.log('resolveGuessingBet: bet not found');
    return null;
  }

  const correctAuthors = bet.correctAuthors?.length
    ? bet.correctAuthors
    : (bet.correctAuthorId ? [bet.correctAuthorId] : []);

  if (!correctAuthors.length) {
    console.log('resolveGuessingBet: no correct authors found');
    return null;
  }

  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]));

  // Build wagers, then IGNORE any wager where the player is a correct author.
  // Authors never gain or lose points based on wagers in their own round.
  const wagers = (bet.guesses || [])
    .map(g => ({
      playerId:        g.playerId,
      guessedAuthorId: g.guessedAuthorId,
      wager:           Math.max(0, Number(g.wager || 0))
    }))
    .filter(w => !correctAuthors.includes(w.playerId));

  console.log('correctAuthors:', correctAuthors);
  console.log('wagers (authors filtered out):', wagers);
  console.log('player scores BEFORE:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));

  const winners = wagers.filter(w =>
    w.wager > 0 &&
    correctAuthors.includes(w.guessedAuthorId)
  );

  const losers = wagers.filter(w =>
    w.wager > 0 &&
    !correctAuthors.includes(w.guessedAuthorId)
  );

  const anyCorrect       = winners.length > 0;
  const losersPot        = losers.reduce((sum, w) => sum + w.wager, 0);
  const totalWinnerWager = winners.reduce((sum, w) => sum + w.wager, 0);

  console.log('winners:', winners.map(w => {
    const p = state.players.find(pl => pl.id === w.playerId);
    return (p ? p.name : w.playerId) + ' wager:' + w.wager;
  }));
  console.log('losers:', losers.map(w => {
    const p = state.players.find(pl => pl.id === w.playerId);
    return (p ? p.name : w.playerId) + ' wager:' + w.wager;
  }));
  console.log('anyCorrect:', anyCorrect, 'losersPot:', losersPot, 'totalWinnerWager:', totalWinnerWager);

  // Deduct losing wagers.
  losers.forEach(w => {
    const player = playerMap[w.playerId];
    if (player) {
      const before = player.currentPoints;
      player.currentPoints = clampScore(player.currentPoints - w.wager);
      console.log('LOSER:', player.name, 'before:', before, 'wager:', w.wager, 'after:', player.currentPoints);
    }
  });

  // Pay out winners.
  if (anyCorrect && losersPot > 0 && totalWinnerWager > 0) {
    winners.forEach(w => {
      const player = playerMap[w.playerId];
      if (!player) return;
      const share  = Math.round((losersPot * w.wager) / totalWinnerWager);
      const before = player.currentPoints;
      player.currentPoints = clampScore(player.currentPoints + share);
      console.log('WINNER:', player.name, 'before:', before, 'share:', share, 'after:', player.currentPoints);
    });
  } else if (!anyCorrect && losersPot > 0) {
    const beforePot = state.pot;
    state.pot += losersPot;
    console.log('No winners — losersPot', losersPot, 'added to Hunny Pot:', beforePot, '->', state.pot);
  } else {
    console.log('No payout branch hit — anyCorrect:', anyCorrect, 'losersPot:', losersPot);
  }

  bet.status       = 'resolved';
  bet.resolvedAt   = new Date().toLocaleString();
  bet.roundWinners = winners.map(w => w.playerId);

  enforceMinPot();
  saveState();

  console.log('player scores AFTER:', state.players.map(p => p.name + ':' + p.currentPoints).join(', '));
  console.log('pot AFTER:', state.pot);
  console.log('--- resolveGuessingBet END ---');

  const authorNames = correctAuthors
    .map(id => state.players.find(p => p.id === id)?.name)
    .filter(Boolean);

  const winnerLines = winners
    .map(w => {
      const p = state.players.find(pl => pl.id === w.playerId);
      return p ? `${p.name} (wagered ${w.wager})` : null;
    })
    .filter(Boolean);

  return {
    betId:            bet.id,
    description:      bet.description,
    attraction:       bet.attraction,
    land:             bet.land,
    createdAt:        bet.createdAt,
    resolvedAt:       bet.resolvedAt,
    authorNames,
    winners:          winnerLines,
    anyCorrect,
    losersPot,
    totalWinnerWager
  };
}
