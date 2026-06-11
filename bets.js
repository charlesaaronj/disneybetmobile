// bets.js
// Creating rounds, collecting answers, guessing/wagering, and resolving rounds.

import {
  state,
  uid,
  clampScore,
  shuffle,
  saveState,
  enforceMinPot,
  alertLike,
  getAvailablePoints
} from './state.js';
import { els, showAnswerModal, hideAnswerModal, goToWager, goToReveal } from './dom.js';
import { escapeHtml } from './state.js';
import { render } from './render.js';
