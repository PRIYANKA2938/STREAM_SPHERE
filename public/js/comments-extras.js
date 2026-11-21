function getUsefulVoteState(commentId) {
  try {
    const states = JSON.parse(localStorage.getItem('streamsphereUsefulVotes') || '{}');
    return states[commentId] || { up: 0, down: 0, users: {} };
  } catch (error) {
    return { up: 0, down: 0, users: {} };
  }
}

function updateUsefulVote(card, value) {
  const states = JSON.parse(localStorage.getItem('streamsphereUsefulVotes') || '{}');
  const state = states[card.dataset.commentId] || { up: 0, down: 0, users: {} };
  const ownerKey = getCommentOwnerKey();
  const previous = Number(state.users[ownerKey] || 0);
  if (previous === value) {
    state[value > 0 ? 'up' : 'down'] = Math.max(0, state[value > 0 ? 'up' : 'down'] - 1);
    delete state.users[ownerKey];
  } else {
    if (previous) state[previous > 0 ? 'up' : 'down'] = Math.max(0, state[previous > 0 ? 'up' : 'down'] - 1);
    state[value > 0 ? 'up' : 'down'] += 1;
    state.users[ownerKey] = value;
  }
  states[card.dataset.commentId] = state;
  localStorage.setItem('streamsphereUsefulVotes', JSON.stringify(states));
  requestCommentMutation('usefulVote', {
    commentId: card.dataset.commentId,
    voterId: ownerKey,
    vote: String(state.users[ownerKey] || 0)
  }).catch(error => console.error('Unable to save useful vote:', error));
  renderUsefulVoteControls(card);
  const text = card.querySelector('.comment-text')?.textContent || '';
  card.classList.toggle('comment-highlighted', card.dataset.isPinned === 'true' || state.up >= 5 || /\b(at \d{1,2}:\d{2}|timestamp|important detail|easter egg)\b/i.test(text));
}

function renderUsefulVoteControls(card) {
  let controls = card.querySelector('.comment-voting');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'comment-voting';
    card.querySelector('.comment-main').appendChild(controls);
  }
  const state = getUsefulVoteState(card.dataset.commentId);
  const selected = Number(state.users[getCommentOwnerKey()] || 0);
  controls.replaceChildren();
  [[1, 'Useful'], [-1, 'Not useful']].forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label + ' · ' + state[value > 0 ? 'up' : 'down'];
    button.classList.toggle('active', selected === value);
    button.setAttribute('aria-pressed', String(selected === value));
    button.addEventListener('click', () => updateUsefulVote(card, value));
    controls.appendChild(button);
  });
}

function applyServerUsefulVoteState(card, counts, viewerVote) {
  const allStates = JSON.parse(localStorage.getItem('streamsphereUsefulVotes') || '{}');
  const state = allStates[card.dataset.commentId] || { up: 0, down: 0, users: {} };
  state.up = Number(counts?.up) || 0;
  state.down = Number(counts?.down) || 0;
  const ownerKey = getCommentOwnerKey();
  const localVote = Number(state.users[ownerKey] || 0);
  if (viewerVote) {
    state.users[ownerKey] = Number(viewerVote);
  } else if (localVote && !localStorage.getItem('streamsphereUsefulVoteMigrated:' + card.dataset.commentId)) {
    state[localVote > 0 ? 'up' : 'down'] += 1;
    requestCommentMutation('usefulVote', {
      commentId: card.dataset.commentId,
      voterId: ownerKey,
      vote: String(localVote)
    }).catch(error => console.error('Unable to migrate useful vote:', error));
    localStorage.setItem('streamsphereUsefulVoteMigrated:' + card.dataset.commentId, 'true');
  } else {
    delete state.users[ownerKey];
  }
  allStates[card.dataset.commentId] = state;
  localStorage.setItem('streamsphereUsefulVotes', JSON.stringify(allStates));
  renderUsefulVoteControls(card);
}

function initializeCommentExtras(card, metadata = {}) {
  const text = card.querySelector('.comment-text')?.textContent || '';
  const language = detectCommentLanguage(card, metadata);
  card.dataset.language = language;
  const sentiment = getCommentSentiment(text);
  const headline = card.querySelector('.comment-headline');
  if (headline && !headline.querySelector('.comment-sentiment')) {
    const badge = document.createElement('span');
    badge.className = 'comment-sentiment ' + sentiment.toLowerCase();
    badge.textContent = sentiment;
    headline.appendChild(badge);
  }
  if (metadata.highlighted || card.dataset.isPinned === 'true' || /\b(at \d{1,2}:\d{2}|timestamp|important detail|easter egg)\b/i.test(text)) card.classList.add('comment-highlighted');
  renderUsefulVoteControls(card);
  let controls = card.querySelector('.comment-management-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'comment-management-controls';
    card.querySelector('.comment-main')?.appendChild(controls);
  }
  if (controls && !controls.querySelector('[data-bookmark-comment]')) {
    const bookmark = document.createElement('button');
    bookmark.type = 'button';
    bookmark.dataset.bookmarkComment = 'true';
    const updateLabel = () => {
      const bookmarks = new Set(JSON.parse(localStorage.getItem('streamsphereBookmarkedComments') || '[]'));
      bookmark.textContent = bookmarks.has(card.dataset.commentId) ? '🔖 Saved' : '🔖 Bookmark';
    };
    updateLabel();
    bookmark.addEventListener('click', () => {
      const saved = new Set(JSON.parse(localStorage.getItem('streamsphereBookmarkedComments') || '[]'));
      if (saved.has(card.dataset.commentId)) saved.delete(card.dataset.commentId);
      else saved.add(card.dataset.commentId);
      localStorage.setItem('streamsphereBookmarkedComments', JSON.stringify([...saved]));
      updateLabel();
      applyCommentViewFilters();
    });
    controls.appendChild(bookmark);
  }
  if (controls && Array.isArray(metadata.editHistory) && metadata.editHistory.length && !controls.querySelector('.comment-edit-history')) {
    const details = document.createElement('details');
    details.className = 'comment-edit-history';
    const summary = document.createElement('summary');
    summary.textContent = 'Edit history (' + metadata.editHistory.length + ')';
    details.appendChild(summary);
    metadata.editHistory.slice().reverse().forEach(edit => {
      const previous = document.createElement('p');
      previous.textContent = edit.text + ' · ' + formatRelativeTime(edit.editedAt);
      details.appendChild(previous);
    });
    controls.appendChild(details);
  }
  if (headline && (usernameIsCreator(card.querySelector('.username')?.textContent || '')) && !headline.querySelector('.verified-creator')) {
    const verified = document.createElement('span');
    verified.className = 'badge verified-creator';
    verified.textContent = 'Verified Creator';
    headline.appendChild(verified);
  }
  if (!card.querySelector('.comment-reply-suggestions')) {
    const suggestions = getAutoReplySuggestions(text);
    const suggestionBar = document.createElement('div');
    suggestionBar.className = 'comment-reply-suggestions';
    suggestions.forEach(suggestion => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = suggestion;
      button.addEventListener('click', () => {
        const replyButton = card.querySelector('.reply-btn');
        if (!replyButton) return;
        openReplyForm(replyButton);
        const textarea = card.querySelector('.reply-form textarea');
        if (textarea) textarea.value = suggestion;
      });
      suggestionBar.appendChild(button);
    });
    card.querySelector('.comment-main')?.appendChild(suggestionBar);
  }
}

function getAutoReplySuggestions(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('?')) return ['I noticed that too!', 'Great question.', 'Thanks for asking!'];
  if (/\b(love|great|amazing|excellent|awesome)\b/.test(normalized)) return ['Glad you enjoyed it!', 'Thanks for watching!', 'What was your favorite part?'];
  if (/\b(hate|awful|terrible|bad|boring)\b/.test(normalized)) return ['Thanks for sharing your feedback.', 'What would you change?', 'We appreciate the honest feedback.'];
  return ['Thanks for sharing!', 'Good point.', 'Tell us more.'];
}

function usernameIsCreator(username) {
  return ['StreamSphere Official', 'StreamSphere Originals', 'Creator'].includes(username.trim());
}
