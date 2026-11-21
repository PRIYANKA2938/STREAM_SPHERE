function getEmojiReactionStore() {
  try {
    const store = JSON.parse(localStorage.getItem('streamsphereEmojiReactions') || '{}');
    return store && typeof store === 'object' ? store : {};
  } catch (error) {
    return {};
  }
}

function renderEmojiReactionResults(card) {
  const results = card.querySelector('.emoji-reaction-results');
  if (!results) return;
  const store = getEmojiReactionStore();
  const state = store[card.dataset.commentId] || { counts: {}, users: {} };
  const selected = state.users[getCommentOwnerKey()] || '';
  results.replaceChildren();
  Object.entries(state.counts).filter(([, count]) => count > 0).forEach(([emoji, count]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji + ' ' + count;
    button.classList.toggle('active', selected === emoji);
    button.setAttribute('aria-label', emoji + ' reaction, ' + count + ' total');
    button.setAttribute('aria-pressed', String(selected === emoji));
    button.addEventListener('click', () => updateEmojiReaction(card, emoji));
    results.appendChild(button);
  });
}

function updateEmojiReaction(card, emoji) {
  const store = getEmojiReactionStore();
  const commentId = card.dataset.commentId;
  const state = store[commentId] || { counts: {}, users: {} };
  const ownerKey = getCommentOwnerKey();
  const previous = state.users[ownerKey] || '';

  if (previous === emoji) {
    state.counts[emoji] = Math.max(0, Number(state.counts[emoji] || 0) - 1);
    delete state.users[ownerKey];
  } else {
    if (previous) state.counts[previous] = Math.max(0, Number(state.counts[previous] || 0) - 1);
    state.counts[emoji] = Number(state.counts[emoji] || 0) + 1;
    state.users[ownerKey] = emoji;
  }

  store[commentId] = state;
  localStorage.setItem('streamsphereEmojiReactions', JSON.stringify(store));
  renderEmojiReactionResults(card);

  // Background sync
  try {
    fetch('/api/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, emoji, reactorId: ownerKey, action: 'emojiReaction' })
    }).catch(() => {});
  } catch (e) {}
}


function initializeEmojiReactions(card) {
  const bar = card.querySelector('.interaction-bar');
  if (!bar || bar.dataset.emojiReactionsReady === 'true') return;
  const wrapper = document.createElement('div');
  wrapper.className = 'emoji-reaction-tools';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'emoji-react-trigger';
  trigger.textContent = 'React';
  trigger.setAttribute('aria-expanded', 'false');
  const picker = document.createElement('div');
  picker.className = 'emoji-reaction-picker';
  picker.hidden = true;
  ['❤️', '😂', '😮', '😢', '🔥'].forEach(emoji => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji;
    button.setAttribute('aria-label', 'React with ' + emoji);
    button.addEventListener('click', () => {
      updateEmojiReaction(card, emoji);
      picker.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    });
    picker.appendChild(button);
  });
  trigger.addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    trigger.setAttribute('aria-expanded', String(!picker.hidden));
  });
  const results = document.createElement('div');
  results.className = 'emoji-reaction-results';
  wrapper.append(trigger, picker, results);
  bar.appendChild(wrapper);
  bar.dataset.emojiReactionsReady = 'true';
  renderEmojiReactionResults(card);
}
