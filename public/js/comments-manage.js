const commentPermissionsState = { canModerate: false, canPin: false };

function updateCommentPinDisplay(card, isPinned) {
  card.dataset.isPinned = String(isPinned);
  let flag = card.querySelector('.pinned-flag');
  if (isPinned && !flag) {
    flag = document.createElement('div');
    flag.className = 'pinned-flag';
    flag.textContent = '📌 Pinned by Creator';
    card.prepend(flag);
  }
  if (flag) flag.hidden = !isPinned;
}

function updateCommentModerationDisplay(card, status, reason) {
  const flag = card.querySelector('.comment-moderation-flag');
  card.dataset.moderationStatus = status || 'Approved';
  const pending = status === 'Pending Review';
  flag.hidden = !pending;
  flag.textContent = pending ? 'Held for review' + (reason ? ': ' + reason : '') : '';
}

function persistLocalCommentUpdate(commentId, updates) {
  const comments = getLocalComments();
  let comment = comments.find(item => item.commentId === commentId);
  if (!comment) {
    comment = { commentId, ownerKey: getCommentOwnerKey(), ownerEmail: localStorage.getItem('streamsphereEmail') || '' };
    comments.push(comment);
  }
  Object.assign(comment, updates);
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  return comment;
}

function renderEditHistory(card, history) {
  let details = card.querySelector('.comment-edit-history');
  if (!history.length) {
    details?.remove();
    return;
  }
  if (!details) {
    details = document.createElement('details');
    details.className = 'comment-edit-history';
    card.querySelector('.comment-management-controls').appendChild(details);
  }
  details.replaceChildren();
  const summary = document.createElement('summary');
  summary.textContent = 'Edit history (' + history.length + ')';
  details.appendChild(summary);
  history.slice().reverse().forEach(edit => {
    const previous = document.createElement('p');
    previous.textContent = edit.text + ' · ' + formatRelativeTime(edit.editedAt);
    details.appendChild(previous);
  });
}

function getDeletedCommentIds() {
  try {
    const ids = JSON.parse(localStorage.getItem('streamsphereDeletedCommentIds') || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch (error) {
    return [];
  }
}

function requestCommentMutation(action, values) {
  return requestCommentJsonp(action, values).then(response => {
    if (response.status !== 'success') {
      throw new Error(response.message || 'Unable to save the comment change.');
    }
    return response;
  });
}

function requestCommentJsonp(action, values = {}) {
  const callbackName = '__streamsphere_' + action + '_' + Date.now();
  const params = new URLSearchParams({
    action,
    callback: callbackName,
    viewerId: getViewerId(),
    sessionToken: localStorage.getItem('streamsphereAuthToken') || '',
    ...values
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(new Error('The comment service did not respond. Check the web app deployment and try again.'));
    }, 15000);
    function finish(error, response) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) reject(error);
      else resolve(response);
    }
    window[callbackName] = response => {
      if (!response || typeof response.status !== 'string') {
        finish(new Error('The comment service returned an unexpected response. Redeploy the current Apps Script version.'));
        return;
      }
      finish(null, response);
    };
    script.onload = () => {
      if (!settled) finish(new Error('The comment service returned no usable response. Redeploy the current Apps Script version.'));
    };
    script.onerror = () => finish(new Error('Unable to contact the comment service.'));
    script.src = document.getElementById('commentForm').action + '?' + params.toString();
    document.body.appendChild(script);
  });
}

function renderCommentReviewQueue(items) {
  const panel = document.getElementById('commentReviewPanel');
  const list = document.getElementById('commentReviewList');
  list.replaceChildren();
  if (!items.length) {
    list.innerHTML = '<p class="notifications-empty">No comments are waiting for review.</p>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('article');
    row.className = 'comment-review-item';
    const copy = document.createElement('div');
    copy.className = 'comment-review-copy';
    const author = document.createElement('strong');
    author.textContent = item.username;
    const text = document.createElement('p');
    text.textContent = item.comment;
    const reason = document.createElement('small');
    reason.textContent = item.reason;
    copy.append(author, text, reason);
    const actions = document.createElement('div');
    actions.className = 'comment-review-actions';
    [['keep', 'Keep comment'], ['remove', 'Remove comment']].forEach(([decision, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = decision === 'keep' ? 'approve-review' : 'reject-review';
      button.textContent = label;
      button.addEventListener('click', () => {
        button.disabled = true;
        fetch('/api/comments/' + encodeURIComponent(item.commentId) + '/moderation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('streamsphereAuthToken')
          },
          body: JSON.stringify({ decision })
        })
          .then(async response => {
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
              throw new Error(result.message || 'Unable to save the moderation decision.');
            }
            row.remove();
            const card = document.querySelector('[data-comment-id="' + CSS.escape(item.commentId) + '"]');
            if (decision === 'remove') {
              card?.remove();
            } else if (card) {
              const flag = card.querySelector('.comment-report-flag');
              if (flag) flag.hidden = true;
              localStorage.removeItem('streamsphereReported_' + item.commentId);
              const reportButton = card.querySelector('.report-btn');
              if (reportButton) {
                reportButton.textContent = 'Report';
                reportButton.disabled = false;
              }
            }
            updateCommentsCount();
          })
          .catch(error => {
            button.disabled = false;
            console.error('Comment moderation failed:', error);
            alert(error.message);
          });
      });
      actions.appendChild(button);
    });
    row.append(copy, actions);
    list.appendChild(row);
  });
}

function loadCommentModerationPermissions() {
  if (!localStorage.getItem('streamsphereAuthToken')) return;
  fetch('/api/comments/review', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('streamsphereAuthToken') }
  }).then(async response => {
    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Unable to load the comment review queue.');
    }
    return result;
  }).then(response => {
    if (response.status !== 'success') return;
    commentPermissionsState.canModerate = response.canModerate === true;
    commentPermissionsState.canPin = false;
    document.getElementById('commentReviewPanel').hidden = !commentPermissionsState.canModerate;
    document.querySelectorAll('.comment-card').forEach(card => {
      initializePinControl(card);
      initializeCommentManagementControls(card, { isOwner: card.dataset.serverOwned === 'true' });
    });
    if (commentPermissionsState.canModerate) {
      renderCommentReviewQueue(response.items || []);
      document.getElementById('commentAnalytics').textContent =
        (response.items || []).length + ' comment' + ((response.items || []).length === 1 ? '' : 's') + ' awaiting review';
    }
  }).catch(error => console.error('Unable to load comment permissions:', error));
}

function initializeCommentManagementControls(card, metadata = {}) {
  const ownerKey = card.dataset.ownerKey || metadata.ownerKey || '';
  const isLocalOwner = ownerKey && ownerKey === getCommentOwnerKey();
  const isServerOwner = card.dataset.serverOwned === 'true' || metadata.isOwner === true;
  if ((!isLocalOwner && !isServerOwner) || card.querySelector('.comment-management-controls button')) return;

  const controls = card.querySelector('.comment-management-controls');
  if (!controls) return;
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => openCommentEditForm(card, isServerOwner));
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', async () => {
    if (!confirm('Delete your comment?')) return;
    deleteButton.disabled = true;
    try {
      if (card.dataset.serverOwned === 'true' || isServerOwner) {
        await requestCommentMutation('deleteComment', { commentId: card.dataset.commentId });
      }
      const deletedIds = getDeletedCommentIds();
      if (!deletedIds.includes(card.dataset.commentId)) deletedIds.push(card.dataset.commentId);
      localStorage.setItem('streamsphereDeletedCommentIds', JSON.stringify(deletedIds));
      localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(getLocalComments().filter(item => item.commentId !== card.dataset.commentId)));
      card.remove();
      updateCommentsCount();
    } catch (error) {
      deleteButton.disabled = false;
      console.error('Comment deletion failed:', error);
      alert(error.message);
    }
  });
  controls.append(editButton, deleteButton);
}

function openCommentEditForm(card, isServerOwner) {
  if (card.querySelector('.comment-edit-form')) return;
  const commentText = card.querySelector('.comment-text');
  const form = document.createElement('form');
  form.className = 'comment-edit-form';
  const textarea = document.createElement('textarea');
  textarea.maxLength = 5000;
  textarea.required = true;
  textarea.value = commentText.textContent;
  const actions = document.createElement('div');
  actions.className = 'reply-form-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'reply-cancel';
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'reply-submit';
  save.textContent = 'Save';
  actions.append(cancel, save);
  form.append(textarea, actions);
  commentText.after(form);
  cancel.addEventListener('click', () => form.remove());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const updatedText = textarea.value.trim();
    const moderationFlags = getModerationFlags(updatedText);
    if (!updatedText || updatedText.length > 5000 || moderationFlags.length) {
      textarea.setCustomValidity(moderationFlags[0] || 'Enter a comment of 1 to 5,000 characters.');
      textarea.reportValidity();
      return;
    }
    textarea.setCustomValidity('');
    save.disabled = true;
    save.textContent = 'Saving...';
    try {
      if (card.dataset.serverOwned === 'true' || isServerOwner) {
        await requestCommentMutation('editComment', { commentId: card.dataset.commentId, comment: updatedText });
      }
    } catch (error) {
      save.disabled = false;
      save.textContent = 'Save';
      console.error('Comment edit failed:', error);
      alert(error.message);
      return;
    }
    const storedComment = getLocalComments().find(item => item.commentId === card.dataset.commentId);
    const editHistory = storedComment?.editHistory || [];
    editHistory.push({ text: commentText.textContent, editedAt: new Date().toISOString() });
    commentText.textContent = updatedText;
    updateCommentModerationDisplay(card, 'Approved', '');
    persistLocalCommentUpdate(card.dataset.commentId, { comment: updatedText, moderationStatus: 'Approved', moderationReason: '', editHistory });
    renderEditHistory(card, editHistory);
    const sentiment = card.querySelector('.comment-sentiment');
    if (sentiment) {
      const nextSentiment = getCommentSentiment(updatedText);
      sentiment.textContent = nextSentiment;
      sentiment.className = 'comment-sentiment ' + nextSentiment.toLowerCase();
    }
    form.remove();
  });
  textarea.focus();
}

function initializePinControl(card) {
  if (!commentPermissionsState.canPin || card.dataset.commentId.startsWith('static-')) return;
  const controls = card.querySelector('.comment-management-controls');
  if (!controls || controls.querySelector('.pin-comment-btn')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pin-comment-btn';
  const updateLabel = () => { button.textContent = card.dataset.isPinned === 'true' ? 'Unpin' : 'Pin'; };
  updateLabel();
  button.addEventListener('click', async () => {
    const shouldPin = card.dataset.isPinned !== 'true';
    const previousPinnedCard = document.querySelector('.comment-card[data-is-pinned="true"]');
    document.querySelectorAll('.comment-card').forEach(otherCard => updateCommentPinDisplay(otherCard, shouldPin && otherCard === card));
    document.querySelectorAll('.pin-comment-btn').forEach(pinButton => {
      const pinnedCard = pinButton.closest('.comment-card');
      pinButton.textContent = pinnedCard.dataset.isPinned === 'true' ? 'Unpin' : 'Pin';
    });
    button.disabled = true;
    try {
      await requestCommentMutation('pinComment', { commentId: card.dataset.commentId, pinned: String(shouldPin) });
    } catch (error) {
      document.querySelectorAll('.comment-card').forEach(otherCard => {
        updateCommentPinDisplay(otherCard, otherCard === previousPinnedCard);
      });
      document.querySelectorAll('.pin-comment-btn').forEach(pinButton => {
        const pinnedCard = pinButton.closest('.comment-card');
        pinButton.textContent = pinnedCard.dataset.isPinned === 'true' ? 'Unpin' : 'Pin';
      });
      console.error('Comment pin update failed:', error);
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  });
  controls.appendChild(button);
}
