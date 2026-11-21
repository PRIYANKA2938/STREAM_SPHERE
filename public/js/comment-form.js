document.getElementById('commentForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  if (this.dataset.submitting === 'true') {
    return;
  }

  const voiceClipKeyInput = document.getElementById('voiceClipKey');
  const commentGifUrlInput = document.getElementById('commentGifUrl');
  if (this.dataset.keepVoiceClip !== 'true') {
    if (voiceClipKeyInput) voiceClipKeyInput.value = '';
    if (commentGifUrlInput) commentGifUrlInput.value = '';
    const recordingStatus = document.getElementById('recordingStatus');
    if (recordingStatus) recordingStatus.textContent = '';
    const voicePreview = document.getElementById('voicePreview');
    if (voicePreview) voicePreview.style.display = 'none';
  }
  delete this.dataset.keepVoiceClip;

  this.dataset.submitting = 'true';
  const submitBtn = document.getElementById('submitBtn');
  const releaseSubmission = () => {
    this.dataset.submitting = 'false';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Comment';
  };
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const statusMsg = document.getElementById('statusMsg');
  const commentText = document.getElementById('commentText');
  const username = document.getElementById('username').value.trim() || 'Guest User';
  const voiceClipKey = voiceClipKeyInput.value;
  const gifUrl = commentGifUrlInput.value;
  const containsSpoiler = document.getElementById('commentSpoilerToggle').checked;
  const comment = commentText.value.trim() || (voiceClipKey ? '[Voice comment]' : gifUrl ? '[GIF]' : '');
  const showLocation = document.getElementById('showLocationToggle').checked;
  const sourceLocation = showLocation ? localStorage.getItem('streamsphereLocation') || '' : '';
  const publicRegion = getPublicCommentRegion(sourceLocation);
  const language = document.getElementById('language')?.value || 'en';
  const commentId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now());

  const moderationFlags = getModerationFlags(comment);
  if (!comment || comment.length > 5000) {
    statusMsg.className = 'form-status error';
    statusMsg.textContent = '✗ ' + (!comment ? 'Add text, a GIF, or a voice recording.' : 'Comments must be 5,000 characters or fewer.');
    statusMsg.style.display = 'block';
    releaseSubmission();
    return;
  }
  if (moderationFlags.length) {
    statusMsg.className = 'form-status error';
    statusMsg.textContent = '✗ Comment blocked: ' + moderationFlags.join(', ');
    statusMsg.style.display = 'block';
    releaseSubmission();
    return;
  }

  const lastPost = Number(localStorage.getItem('streamsphereLastCommentAt:' + getCommentOwnerKey()) || 0);
  const secondsUntilNextPost = Math.ceil((10000 - (Date.now() - lastPost)) / 1000);
  if (lastPost && secondsUntilNextPost > 0) {
    statusMsg.className = 'form-status error';
    statusMsg.textContent = 'Slow mode is on. Try again in ' + secondsUntilNextPost + ' seconds.';
    statusMsg.style.display = 'block';
    releaseSubmission();
    return;
  }

  if (comment.length <= 5000) {
    try {
      const serverModeration = await requestCommentJsonp('checkComment', { comment });
      if (serverModeration.allowed === false) {
        const reason = serverModeration.message || 'This comment does not meet community guidelines.';
        statusMsg.className = 'form-status error';
        statusMsg.textContent = '✗ Comment blocked: ' + reason;
        statusMsg.style.display = 'block';
        releaseSubmission();
        return;
      }
    } catch (error) {
      console.warn('Server moderation preflight unavailable:', error);
    }
  }

  // 1. Immediately post and save comment so it never blocks or shows a JSON error
  const timestamp = new Date().toISOString();
  const savedComment = {
    username,
    comment,
    commentId,
    timestamp,
    location: '',
    publicRegion: publicRegion || '',
    showLocation: Boolean(publicRegion),
    likes: 0,
    dislikes: 0,
    ownerKey: getCommentOwnerKey(),
    ownerEmail: localStorage.getItem('streamsphereEmail') || '',
    moderationStatus: 'Approved',
    moderationReason: '',
    gifUrl,
    voiceClipKey,
    spoiler: containsSpoiler,
    language
  };

  saveLocalComment(savedComment);
  addCommentToDashboard(username, comment, true, commentId, 0, 0, '', timestamp, '', savedComment);
  localStorage.setItem('streamsphereLastCommentAt:' + getCommentOwnerKey(), String(Date.now()));

  // 2. Show green success message immediately
  statusMsg.className = 'form-status success';
  statusMsg.textContent = '✓ Comment posted.';
  statusMsg.style.display = 'block';

  // 3. Clear the input box
  this.dataset.keepVoiceClip = 'true';
  this.reset();
  commentText.focus();

  // 4. Hide the green banner after 3 seconds
  setTimeout(() => {
    statusMsg.style.display = 'none';
  }, 3000);

  // 5. Safe background sync to backend (safely ignores 403 Forbidden or offline servers)
  try {
    fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentId,
        videoId: document.getElementById('videoId')?.value || 'celestial-anomaly-ep4',
        username,
        text: comment,
        viewerId: typeof getViewerId === 'function' ? getViewerId() : 'guest',
        location: sourceLocation,
        showLocation: showLocation && Boolean(publicRegion),
        language
      })
    }).catch(err => console.warn('Comment background sync:', err));
  } catch (e) {}

  releaseSubmission();
});
