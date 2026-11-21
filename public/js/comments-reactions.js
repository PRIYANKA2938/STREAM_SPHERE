function parseReactionCount(value) {
  const match = value.trim().match(/^([\d.]+)(K|M)?$/i);
  if (!match) return 0;
  const multiplier = match[2] && match[2].toUpperCase() === 'M' ? 1000000 : match[2] ? 1000 : 1;
  return Math.round(Number(match[1]) * multiplier);
}

function initializeReactionControls(card, likes, dislikes, viewerReaction = '') {
  const bar = card.querySelector('.interaction-bar');
  if (!bar) return;
  if (bar.dataset.reactionsReady === 'true') {
    const likeButton = bar.querySelector('.reaction-btn[data-reaction="like"]');
    const dislikeButton = bar.querySelector('.reaction-btn[data-reaction="dislike"]');
    if (likeButton) likeButton.querySelector('span').textContent = Number(likes || 0).toLocaleString();
    if (dislikeButton) dislikeButton.querySelector('span').textContent = Number(dislikes || 0).toLocaleString();
    card.dataset.reaction = viewerReaction || '';
    bar.querySelectorAll('.reaction-btn').forEach(button => {
      const isActive = button.dataset.reaction === viewerReaction;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    return;
  }
  card.dataset.reaction = viewerReaction || '';
  const replyButton = bar.querySelector('.reply-btn');

  [...bar.children].forEach(node => {
    const isLegacyReactionNode = node.matches('.action') || (node.tagName === 'SVG' && !node.closest('.reaction-btn'));
    const isReplyNode = node === replyButton;
    if (isLegacyReactionNode && !isReplyNode) {
      node.remove();
    }
  });

  const likeButton = createReactionButton('👍', likes, 'like');
  const dislikeButton = createReactionButton('👎', dislikes, 'dislike');
  bar.prepend(dislikeButton);
  bar.prepend(likeButton);
  if (replyButton) bar.appendChild(replyButton);
  bar.dataset.reactionsReady = 'true';
  if (viewerReaction) {
    const activeButton = bar.querySelector('.reaction-btn[data-reaction="' + viewerReaction + '"]');
    activeButton?.classList.add('active');
    activeButton?.setAttribute('aria-pressed', 'true');
  }
}

function createReactionButton(icon, count, reaction) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reaction-btn';
  button.dataset.reaction = reaction;
  button.innerHTML = icon + ' <span>' + count.toLocaleString() + '</span>';
  button.setAttribute('aria-pressed', 'false');

  button.addEventListener('click', function() {
    const card = button.closest('.comment-card');
    if (!card) return;

    const previousReaction = card.dataset.reaction || '';
    const nextReaction = previousReaction === reaction ? '' : reaction;
    card.dataset.reactionVersion = String((Number(card.dataset.reactionVersion) || 0) + 1);

    const countFor = name => Number(card.querySelector('.reaction-btn[data-reaction="' + name + '"] span')?.textContent.replace(/,/g, '')) || 0;
    const previousCounts = { likes: countFor('like'), dislikes: countFor('dislike') };
    const nextCounts = { ...previousCounts };

    // Toggle logic: remove previous reaction count if any
    if (previousReaction) {
      nextCounts[previousReaction === 'like' ? 'likes' : 'dislikes'] = Math.max(0, nextCounts[previousReaction === 'like' ? 'likes' : 'dislikes'] - 1);
    }
    // Apply new reaction count if not un-reacting
    if (nextReaction) {
      nextCounts[nextReaction === 'like' ? 'likes' : 'dislikes'] += 1;
    }

    // 1. Immediately update UI
    initializeReactionControls(card, nextCounts.likes, nextCounts.dislikes, nextReaction);

    // 2. Persist to localStorage store so it NEVER disappears across reloads
    try {
      const reactionsStore = JSON.parse(localStorage.getItem('streamsphereCommentReactions') || '{}');
      reactionsStore[card.dataset.commentId] = {
        likes: nextCounts.likes,
        dislikes: nextCounts.dislikes,
        reaction: nextReaction
      };
      localStorage.setItem('streamsphereCommentReactions', JSON.stringify(reactionsStore));

      // Also update local dynamic comments if present
      if (typeof getLocalComments === 'function') {
        const localComments = getLocalComments();
        const localComment = localComments.find(c => c.commentId === card.dataset.commentId);
        if (localComment) {
          localComment.likes = nextCounts.likes;
          localComment.dislikes = nextCounts.dislikes;
          localComment.reaction = nextReaction;
          localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(localComments));
        }
      }
    } catch (e) {
      console.warn('Unable to write reaction to local storage:', e);
    }

    // 3. Background sync to backend (safe: does NOT revert if server is offline)
    fetch('/api/comments/' + encodeURIComponent(card.dataset.commentId) + '/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reaction: nextReaction,
        reactorId: typeof getViewerId === 'function' ? getViewerId() : 'anonymous',
        videoId: document.getElementById('videoId')?.value || 'celestial-anomaly-ep4',
        username: card.querySelector('.username')?.textContent.trim() || 'Guest User',
        text: card.dataset.originalComment || card.querySelector('.comment-text')?.textContent.trim() || ''
      })
    }).catch(err => {
      // Keep optimistic local update; do not revert
      console.warn('Backend reaction sync skipped (running in offline mode):', err.message);
    });
  });

  return button;
}
