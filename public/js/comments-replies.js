function addReplyToComment(parentCard, username, comment, timestamp, commentId = '', ownerKey = '') {
  let replies = parentCard.querySelector('.replies-list');
  if (!replies) {
    replies = document.createElement('div');
    replies.className = 'replies-list';
    parentCard.querySelector('.comment-main').appendChild(replies);
  }

  const reply = document.createElement('div');
  reply.className = 'reply-item';
  reply.dataset.commentId = commentId;
  reply.dataset.ownerKey = ownerKey || (typeof getCommentOwnerKey === 'function' ? getCommentOwnerKey() : '');

  reply.innerHTML = `
    <strong></strong> <span></span> <span class="timestamp dim"></span>
    <div class="reply-text" style="margin: 3px 0 6px;"></div>
    <div class="comment-management-controls" style="margin-top: 2px; gap: 8px;">
      <button type="button" class="reply-edit-btn" style="background:none;border:none;color:var(--muted, #94a3b8);cursor:pointer;font-size:12px;padding:0;">Edit</button>
      <button type="button" class="reply-delete-btn" style="background:none;border:none;color:var(--muted, #94a3b8);cursor:pointer;font-size:12px;padding:0;">Delete</button>
    </div>
  `;

  reply.querySelector('strong').textContent = username;
  reply.querySelector('span').textContent = 'replied';
  reply.querySelector('.timestamp').textContent = '\u2022 ' + formatRelativeTime(timestamp);
  reply.querySelector('.timestamp').dataset.timestamp = timestamp;
  reply.querySelector('.reply-text').textContent = comment;

  if (typeof usernameIsCreator === 'function' && usernameIsCreator(username)) {
    const badge = document.createElement('span');
    badge.className = 'badge verified-creator';
    badge.textContent = 'Verified Creator';
    reply.querySelector('strong').after(badge);
  }

  // Delete Reply Handler
  reply.querySelector('.reply-delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete your reply?')) return;
    const deletedIds = typeof getDeletedCommentIds === 'function' ? getDeletedCommentIds() : [];
    if (!deletedIds.includes(commentId)) deletedIds.push(commentId);
    localStorage.setItem('streamsphereDeletedCommentIds', JSON.stringify(deletedIds));

    if (typeof getLocalComments === 'function') {
      const remaining = getLocalComments().filter(item => item.commentId !== commentId);
      localStorage.setItem('streamsphereComments', JSON.stringify(remaining));
    }

    try {
      fetch('/api/comments/' + encodeURIComponent(commentId), { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    reply.remove();
    if (typeof updateCommentsCount === 'function') updateCommentsCount();
  });

  // Edit Reply Handler
  reply.querySelector('.reply-edit-btn').addEventListener('click', () => {
    openReplyEditForm(reply, commentId);
  });

  replies.appendChild(reply);
  if (typeof updateCommentsCount === 'function') updateCommentsCount();
}

function openReplyEditForm(replyItem, commentId) {
  if (replyItem.querySelector('.reply-edit-form')) return;
  const replyTextEl = replyItem.querySelector('.reply-text');
  const currentText = replyTextEl.textContent;

  const form = document.createElement('form');
  form.className = 'reply-edit-form';
  form.style.marginTop = '6px';
  form.innerHTML = `
    <textarea required style="width:100%;min-height:50px;padding:6px;background:var(--input-bg, rgba(0,0,0,0.3));color:var(--body-text, #fff);border:1px solid var(--input-border, rgba(255,255,255,0.2));border-radius:4px;font:inherit;font-size:13px;"></textarea>
    <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
      <button type="button" class="reply-edit-cancel" style="padding:4px 10px;background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:3px;font-size:12px;cursor:pointer;">Cancel</button>
      <button type="submit" class="reply-edit-save" style="padding:4px 10px;background:var(--accent-blue, #2563eb);color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;font-weight:600;">Save</button>
    </div>
  `;

  const textarea = form.querySelector('textarea');
  textarea.value = currentText;

  replyTextEl.style.display = 'none';
  replyTextEl.after(form);
  textarea.focus();

  form.querySelector('.reply-edit-cancel').addEventListener('click', () => {
    form.remove();
    replyTextEl.style.display = '';
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const updated = textarea.value.trim();
    if (!updated) return;

    replyTextEl.textContent = updated;
    replyTextEl.style.display = '';
    form.remove();

    // Update in localStorage
    if (typeof getLocalComments === 'function') {
      const comments = getLocalComments();
      const target = comments.find(item => item.commentId === commentId);
      if (target) {
        target.comment = updated;
        localStorage.setItem('streamsphereComments', JSON.stringify(comments));
      }
    }

    // Background sync to backend
    try {
      fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'editComment', commentId, comment: updated })
      }).catch(() => {});
    } catch (e) {}
  });
}

function openReplyForm(button) {
  const card = button.closest('.comment-card');
  if (!card || card.querySelector('.reply-form')) return;
  const form = document.createElement('form');
  form.className = 'reply-form';
  form.innerHTML = '<textarea required placeholder="Write a reply..."></textarea><div class="reply-form-actions"><button type="button" class="reply-cancel">Cancel</button><button type="submit" class="reply-submit">Reply</button></div>';
  card.querySelector('.comment-main').appendChild(form);
  form.querySelector('textarea').focus();
  form.querySelector('.reply-cancel').addEventListener('click', () => form.remove());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    const replyText = textarea.value.trim();
    if (typeof getModerationMessage === 'function') {
      const moderationMessage = getModerationMessage(replyText);
      textarea.setCustomValidity('');
      if (moderationMessage) {
        textarea.setCustomValidity(moderationMessage);
        textarea.reportValidity();
        return;
      }
    }

    const submitButton = form.querySelector('.reply-submit');
    const username = document.getElementById('username')?.value.trim() || 'Guest User';
    const ownerKey = typeof getCommentOwnerKey === 'function' ? getCommentOwnerKey() : 'guest';
    const replyId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'reply-' + Date.now();
    const timestamp = new Date().toISOString();

    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    // 1. Instantly save reply to localStorage
    if (typeof saveLocalComment === 'function') {
      saveLocalComment({
        username,
        comment: replyText,
        commentId: replyId,
        parentCommentId: card.dataset.commentId,
        timestamp,
        likes: 0,
        dislikes: 0,
        ownerKey,
        ownerEmail: localStorage.getItem('streamsphereEmail') || ''
      });
    }

    // 2. Add reply directly to UI with Edit/Delete controls
    addReplyToComment(card, username, replyText, timestamp, replyId, ownerKey);

    // 3. Background sync
    try {
      fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: replyId,
          parentCommentId: card.dataset.commentId,
          videoId: document.getElementById('videoId')?.value || 'celestial-anomaly-ep4',
          username,
          text: replyText,
          viewerId: typeof getViewerId === 'function' ? getViewerId() : 'guest',
          language: document.getElementById('language')?.value || 'en'
        })
      }).catch(err => console.warn('Reply backend sync:', err));
    } catch (e) {}

    form.remove();
  });
}

document.addEventListener('click', event => {
  const replyButton = event.target.closest('.reply-btn');
  if (replyButton) openReplyForm(replyButton);
});
