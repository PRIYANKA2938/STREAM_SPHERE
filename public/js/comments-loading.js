// Auto-set username from localStorage when available.
window.addEventListener('load', function() {
  const savedUsername = localStorage.getItem('streamsphereName');
  if (savedUsername) {
    document.getElementById('username').value = savedUsername;
  }
  const sessionToken = localStorage.getItem('streamsphereAuthToken') || '';
  document.getElementById('email').value = sessionToken ? localStorage.getItem('streamsphereEmail') || '' : '';
  const deletedIds = new Set(getDeletedCommentIds());
  const localComments = getLocalComments().filter(comment => !deletedIds.has(comment.commentId));
  localComments.forEach(comment => {
    comment.publicRegion = comment.showLocation
      ? comment.publicRegion || getPublicCommentRegion(comment.location)
      : '';
    comment.location = '';
    comment.showLocation = Boolean(comment.publicRegion);
  });
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(localComments));
  localComments.filter(comment => !comment.parentCommentId).forEach(comment => {
    addCommentToDashboard(comment.username, comment.comment, false, comment.commentId, comment.likes, comment.dislikes, comment.reaction || '', comment.timestamp, comment.showLocation ? comment.location : '', comment);
  });
  localComments.filter(comment => comment.parentCommentId).forEach(comment => {
    const parentCard = document.querySelector('[data-comment-id="' + comment.parentCommentId + '"]');
    if (parentCard) addReplyToComment(parentCard, comment.username, comment.comment, comment.timestamp, comment.commentId);
  });
  updateCommentsCount();
  renderCommentNotifications();
  loadServerCommentNotifications();
  loadSavedComments([...localComments.map(comment => comment.commentId), ...deletedIds]);
  loadCommentModerationPermissions();
});

function loadSavedComments(localCommentIds = []) {
  const reactionVersions = new Map(
    [...document.querySelectorAll('#commentsList .comment-card')].map(card => [
      card.dataset.commentId,
      Number(card.dataset.reactionVersion || 0)
    ])
  );
  const callbackName = '__streamsphereComments_' + Date.now();
  window[callbackName] = function(response) {
    if (response.status === 'success') {
      const localIds = new Set(localCommentIds);
      const localComments = getLocalComments();
      localComments.forEach(comment => localIds.add(comment.commentId));
      document.querySelectorAll('#commentsList [data-comment-id]').forEach(item => localIds.add(item.dataset.commentId));
      response.comments.forEach(comment => {
        const localComment = localComments.find(item => item.commentId === comment.commentId);
        const localCard = document.querySelector('[data-comment-id="' + CSS.escape(comment.commentId) + '"]');
        const reactionChanged = localCard &&
          Number(localCard.dataset.reactionVersion || 0) !== (reactionVersions.get(comment.commentId) || 0);
        if (localComment) {
          Object.assign(localComment, {
            moderationStatus: comment.moderationStatus || 'Approved',
            moderationReason: comment.moderationReason || '',
            editHistory: comment.editHistory || [],
            location: '',
            publicRegion: comment.showLocation ? comment.publicRegion || getPublicCommentRegion(comment.location) : '',
            showLocation: comment.showLocation === true && Boolean(comment.publicRegion || getPublicCommentRegion(comment.location)),
            spoiler: comment.spoiler === true,
            language: comment.language || 'English',
            gifUrl: comment.gifUrl || '',
            voiceClipKey: comment.voiceClipKey || '',
            reportCount: comment.reportCount || 0
          });
          if (!reactionChanged) {
            Object.assign(localComment, {
              likes: comment.likes,
              dislikes: comment.dislikes,
              reaction: comment.viewerReaction || ''
            });
          }
        }
        if (localCard) {
          localCard.dataset.serverOwned = String(comment.isOwner === true);
          if (comment.isOwner) localCard.dataset.ownerKey = getCommentOwnerKey();
          initializeCommentManagementControls(localCard, { isOwner: comment.isOwner === true });
          if (!reactionChanged) {
            initializeReactionControls(localCard, comment.likes, comment.dislikes, comment.viewerReaction || '');
          }
          localCard.dataset.reportCount = String(comment.reportCount || 0);
          updateCommentModerationDisplay(localCard, comment.moderationStatus, comment.moderationReason);
          const location = localCard.querySelector('.location');
          if (location) location.textContent = comment.showLocation ? comment.publicRegion || getPublicCommentRegion(comment.location) : '';
          if (comment.isReported) markCommentReportedForReview(localCard);
          renderCommentBody(localCard, comment.comment, comment);
          const emojiStore = getEmojiReactionStore();
          const emojiState = emojiStore[comment.commentId] || { counts: {}, users: {} };
          emojiState.counts = comment.emojiReactionCounts || {};
          if (comment.viewerEmoji) emojiState.users[getCommentOwnerKey()] = comment.viewerEmoji;
          else delete emojiState.users[getCommentOwnerKey()];
          emojiStore[comment.commentId] = emojiState;
          localStorage.setItem('streamsphereEmojiReactions', JSON.stringify(emojiStore));
          renderEmojiReactionResults(localCard);
          applyServerUsefulVoteState(localCard, comment.usefulVoteCounts, comment.viewerUsefulVote);
          const reportButton = localCard.querySelector('.report-btn');
          if (reportButton && comment.hasReported) {
            reportButton.textContent = 'Reported';
            localStorage.setItem('streamsphereReported_' + comment.commentId, 'true');
          }
        }
      });
      localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(localComments));
      const unseenComments = response.comments.filter(comment => {
        if (localIds.has(comment.commentId)) return false;
        localIds.add(comment.commentId);
        return true;
      });
      unseenComments.slice().reverse().filter(comment => !comment.parentCommentId).forEach(comment => {
        addCommentToDashboard(comment.username, comment.comment, false, comment.commentId, comment.likes, comment.dislikes, comment.viewerReaction, comment.timestamp, comment.showLocation ? getPublicCommentRegion(comment.location) : '', {
          isOwner: comment.isOwner,
          ownerKey: comment.isOwner ? getCommentOwnerKey() : '',
          isPinned: comment.isPinned,
          showLocation: comment.showLocation,
          reportCount: comment.reportCount,
          hasReported: comment.hasReported,
          isReported: comment.isReported,
          publicRegion: comment.publicRegion,
          usefulVoteCounts: comment.usefulVoteCounts,
          viewerUsefulVote: comment.viewerUsefulVote,
          moderationStatus: comment.moderationStatus,
          moderationReason: comment.moderationReason,
          emojiReactionCounts: comment.emojiReactionCounts,
          viewerEmoji: comment.viewerEmoji,
          gifUrl: comment.gifUrl,
          voiceClipKey: comment.voiceClipKey,
          spoiler: comment.spoiler,
          language: comment.language,
          editHistory: comment.editHistory
        });
      });
      unseenComments.filter(comment => comment.parentCommentId).forEach(comment => {
        const parentCard = document.querySelector('[data-comment-id="' + comment.parentCommentId + '"]');
        if (parentCard) addReplyToComment(parentCard, comment.username, comment.comment, comment.timestamp, comment.commentId);
      });
      updateCommentsCount();
      syncStaticCommentInteractions();
    }
    delete window[callbackName];
    script.remove();
  };

  const script = document.createElement('script');
  const params = new URLSearchParams({
    callback: callbackName,
    reactorId: getViewerId(),
    emojiReactorId: getCommentOwnerKey(),
    usefulVoterId: getCommentOwnerKey(),
    reporterId: getViewerId(),
    viewerId: getViewerId(),
    sessionToken: localStorage.getItem('streamsphereAuthToken') || ''
  });
  script.src = document.getElementById('commentForm').action + '?' + params.toString();
  script.onerror = function() {
    delete window[callbackName];
    script.remove();
  };
  document.body.appendChild(script);
}

function syncStaticCommentInteractions() {
  const cards = [...document.querySelectorAll('#commentsList .comment-card[data-comment-id^="static-"]')];
  if (!cards.length) return;
  requestCommentJsonp('getCommentInteractions', {
    commentIds: cards.map(card => card.dataset.commentId).join(','),
    reactorId: getViewerId(),
    emojiReactorId: getCommentOwnerKey(),
    usefulVoterId: getCommentOwnerKey(),
    reporterId: getViewerId()
  }).then(response => {
    if (response.status !== 'success') throw new Error(response.message || 'Unable to load comment interactions.');
    cards.forEach(card => {
      const state = response.items[card.dataset.commentId];
      if (!state) return;
      initializeReactionControls(card, state.likes, state.dislikes, state.viewerReaction);
      card.dataset.reportCount = String(state.reportCount);
      const emojiStore = getEmojiReactionStore();
      const emojiState = emojiStore[card.dataset.commentId] || { counts: {}, users: {} };
      emojiState.counts = state.emojiReactionCounts;
      if (state.viewerEmoji) emojiState.users[getCommentOwnerKey()] = state.viewerEmoji;
      else delete emojiState.users[getCommentOwnerKey()];
      emojiStore[card.dataset.commentId] = emojiState;
      localStorage.setItem('streamsphereEmojiReactions', JSON.stringify(emojiStore));
      renderEmojiReactionResults(card);
      if (state.usefulVoteCounts) {
        applyServerUsefulVoteState(card, state.usefulVoteCounts, state.viewerUsefulVote);
      }
      const reportButton = card.querySelector('.report-btn');
      if (reportButton && state.hasReported) {
        reportButton.textContent = 'Reported';
        localStorage.setItem('streamsphereReported_' + card.dataset.commentId, 'true');
      }
    });
  }).catch(error => console.error('Unable to load comment interactions:', error));
}

setInterval(updateRelativeTimestamps, 60000);

function getLocalComments() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY) || '[]');
  } catch (error) {
    console.error('Unable to read local comments:', error);
    return [];
  }
}

function saveLocalComment(comment) {
  try {
    const comments = getLocalComments().filter(item => item.commentId !== comment.commentId);
    comments.push(comment);
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  } catch (error) {
    console.error('Unable to save local comment:', error);
  }
}

function updateCommentsCount() {
  const commentsCount = document.getElementById('commentsCount');
  const total = document.querySelectorAll('#commentsList .comment-card, #commentsList .reply-item').length;
  commentsCount.textContent = 'Comments · ' + total.toLocaleString();
}
