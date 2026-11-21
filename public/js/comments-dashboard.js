function addCommentToDashboard(username, comment, updateCount = true, commentId = '', likes = 0, dislikes = 0, viewerReaction = '', timestamp = new Date().toISOString(), location = '', metadata = {}) {
  const commentsList = document.getElementById('commentsList');
  const card = document.createElement('article');
  card.className = 'comment-card';
  card.dataset.commentId = commentId;
  card.dataset.ownerKey = metadata.ownerKey || '';
  card.dataset.ownerEmail = metadata.ownerEmail || '';
  card.dataset.serverOwned = String(metadata.isOwner === true);
  card.dataset.isPinned = String(metadata.isPinned === true);
  card.dataset.moderationStatus = metadata.moderationStatus || 'Approved';
  card.dataset.language = metadata.language || '';
  card.dataset.reportCount = String(metadata.reportCount || 0);
  card.innerHTML = `
    <div class="pinned-flag" hidden><span aria-hidden="true">📌</span> Pinned by Creator</div>
    <div class="comment-body">
      <div class="avatar-placeholder"></div>
      <div class="comment-main">
        <div class="comment-headline">
          <span class="username"></span><span class="location"></span>
          <span class="timestamp dim">&bull; ${formatRelativeTime(timestamp)}</span>
        </div>
        <p class="comment-text"></p>
        <span class="comment-moderation-flag" hidden></span>
        <span class="comment-report-flag" hidden></span>
        <div class="comment-management-controls"></div>
        <div class="interaction-bar">
          <button type="button" class="reply-btn">Reply</button>
        </div>
      </div>
    </div>`;
  card.querySelector('.avatar-placeholder').textContent = username.charAt(0).toUpperCase();
  card.querySelector('.username').textContent = username;
  card.querySelector('.location').textContent = metadata.publicRegion || getPublicCommentRegion(location);
  renderCommentBody(card, comment, metadata);
  card.querySelector('.timestamp').dataset.timestamp = timestamp;
  if (metadata.emojiReactionCounts) {
    const emojiStore = getEmojiReactionStore();
    const emojiState = emojiStore[commentId] || { counts: {}, users: {} };
    emojiState.counts = metadata.emojiReactionCounts;
    if (metadata.viewerEmoji) emojiState.users[getCommentOwnerKey()] = metadata.viewerEmoji;
    emojiStore[commentId] = emojiState;
    localStorage.setItem('streamsphereEmojiReactions', JSON.stringify(emojiStore));
  }
  updateCommentPinDisplay(card, metadata.isPinned === true);
  updateCommentModerationDisplay(card, metadata.moderationStatus || 'Approved', metadata.moderationReason || '');
  commentsList.prepend(card);
  initializeTranslationControls(card);
  initializeReactionControls(card, likes, dislikes, viewerReaction);
  initializeReportControl(card);
  if (metadata.isReported) markCommentReportedForReview(card);
  if (metadata.hasReported) {
    const reportButton = card.querySelector('.report-btn');
    if (reportButton) reportButton.textContent = 'Reported';
    markCommentReportedForReview(card);
    localStorage.setItem('streamsphereReported_' + commentId, 'true');
  }
  initializeEmojiReactions(card);
  initializeCommentManagementControls(card, metadata);
  initializePinControl(card);
  initializeCommentExtras(card, metadata);
  if (metadata.usefulVoteCounts) {
    applyServerUsefulVoteState(card, metadata.usefulVoteCounts, metadata.viewerUsefulVote);
  }

  if (updateCount) {
    updateCommentsCount();
  }
}
