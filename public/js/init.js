updateMuteButton();
if (partyRoomId) connectToParty(partyRoomId);
setInterval(pollPartyState, 1000);

document.querySelectorAll('.comment-card').forEach((card, index) => {
  card.dataset.commentId = card.dataset.commentId || 'static-' + index;
  card.dataset.isPinned = String(!!card.querySelector('.pinned-flag') && !card.querySelector('.pinned-flag').hidden);
  const staticCommentText = card.querySelector('.comment-text');
  if (staticCommentText) {
    const originalText = staticCommentText.textContent;
    staticCommentText.replaceChildren();
    appendSafeCommentText(staticCommentText, originalText);
  }
  initializeTranslationControls(card);
    const action = card.querySelector('.interaction-bar .action');
  const defaultLikes = action ? parseReactionCount(action.textContent) : 0;
  const savedReactions = JSON.parse(localStorage.getItem('streamsphereCommentReactions') || '{}');
  const saved = savedReactions[card.dataset.commentId];

  const likes = saved ? saved.likes : defaultLikes;
  const dislikes = saved ? saved.dislikes : 0;
  const userReaction = saved ? saved.reaction : '';

  initializeReactionControls(card, likes, dislikes, userReaction);

  initializeReportControl(card);
  initializeEmojiReactions(card);
  initializeCommentManagementControls(card);
  initializePinControl(card);
  initializeCommentExtras(card);
});
