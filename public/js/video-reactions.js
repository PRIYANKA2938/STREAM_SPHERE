let videoReactionCounts = { likes: 0, dislikes: 0 };

function currentVideoId() {
  return document.getElementById('videoId')?.value || 'celestial-anomaly-ep4';
}

function currentVideoReactionKey() {
  return 'streamsphereVideoReaction:' + currentVideoId();
}

function currentVideoReactionCountsKey() {
  return 'streamsphereVideoReactionCounts:' + currentVideoId();
}

function getVideoReactorId() {
  let reactorId = localStorage.getItem('streamsphereVideoReactorId');
  if (!reactorId) {
    reactorId = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'viewer-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('streamsphereVideoReactorId', reactorId);
  }
  return reactorId;
}

function getStoredVideoReactionCounts() {
  try {
    const raw = localStorage.getItem(currentVideoReactionCountsKey());
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { likes: 0, dislikes: 0}; // Default baseline count
}

function updateVideoReactionButtons(reaction, counts = videoReactionCounts) {
  videoReactionCounts = {
    likes: Math.max(0, Number(counts.likes) || 0),
    dislikes: Math.max(0, Number(counts.dislikes) || 0)
  };
  localStorage.setItem(currentVideoReactionCountsKey(), JSON.stringify(videoReactionCounts));
  document.querySelectorAll('.video-reaction').forEach(button => {
    const isLike = button.dataset.videoReaction === 'like';
    const isActive = button.dataset.videoReaction === reaction;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    const count = button.querySelector('.video-reaction-count');
    const total = isLike ? videoReactionCounts.likes : videoReactionCounts.dislikes;
    if (count) count.textContent = total.toLocaleString();
    button.setAttribute('aria-label', (isLike ? 'Like video, ' : 'Dislike video, ') + total.toLocaleString());
  });
}

function loadVideoReactionState() {
  const videoId = currentVideoId();
  const key = currentVideoReactionKey();
  const savedReaction = localStorage.getItem(key) || '';
  const initialCounts = getStoredVideoReactionCounts();
  updateVideoReactionButtons(savedReaction, initialCounts);

  // Background sync from backend if online
  fetch('/api/video-reactions?' + new URLSearchParams({ videoId, reactorId: getVideoReactorId() }))
    .then(r => r.json())
    .then(data => {
      if (data && data.status === 'success') {
        const viewerReaction = data.viewerReaction || savedReaction;
        localStorage.setItem(key, viewerReaction);
        updateVideoReactionButtons(viewerReaction, data);
      }
    })
    .catch(() => {});
}

document.querySelectorAll('.video-reaction').forEach(button => {
  button.addEventListener('click', function() {
    const videoId = currentVideoId();
    const clickedReaction = this.dataset.videoReaction;
    const key = currentVideoReactionKey();
    const previousReaction = localStorage.getItem(key) || '';
    const nextReaction = previousReaction === clickedReaction ? '' : clickedReaction;

    const nextCounts = { ...videoReactionCounts };
    if (previousReaction === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1);
    if (previousReaction === 'dislike') nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
    if (nextReaction === 'like') nextCounts.likes += 1;
    if (nextReaction === 'dislike') nextCounts.dislikes += 1;

    localStorage.setItem(key, nextReaction);
    updateVideoReactionButtons(nextReaction, nextCounts);

    if (typeof updateLikedVideoHistory === 'function') {
      updateLikedVideoHistory(nextReaction === 'like');
    }

    // Sync to backend without reverting on failure
    fetch('/api/video-reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, reactorId: getVideoReactorId(), reaction: nextReaction })
    }).catch(err => console.warn('Video reaction offline:', err));
  });
});

loadVideoReactionState();
