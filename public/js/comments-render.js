function getCommentSentiment(text) {
  const normalized = text.toLowerCase();
  const positive = (normalized.match(/\b(love|great|amazing|excellent|awesome|beautiful|good|fantastic|helpful|wonderful)\b/g) || []).length;
  const negative = (normalized.match(/\b(hate|awful|terrible|bad|boring|worst|annoying|poor|useless|disappointing)\b/g) || []).length;
  if (positive > negative) return 'Positive';
  if (negative > positive) return 'Negative';
  return 'Neutral';
}

function detectCommentLanguage(card, metadata = {}) {
  const supplied = String(metadata.language || '').toLowerCase();
  const explicit = card.querySelector('.comment-text')?.getAttribute('lang') || '';
  if (supplied.startsWith('english') || supplied === 'en') return 'en';
  if (supplied.startsWith('tamil') || supplied === 'ta' || explicit === 'ta') return 'ta';
  if (supplied.startsWith('hindi') || supplied === 'hi' || explicit === 'hi') return 'hi';
  if (supplied.startsWith('spanish') || supplied === 'es' || explicit === 'es') return 'es';
  if (/[\u0B80-\u0BFF]/.test(card.querySelector('.comment-text')?.textContent || '')) return 'ta';
  if (/[\u0900-\u097F]/.test(card.querySelector('.comment-text')?.textContent || '')) return 'hi';
  return supplied || explicit || 'en';
}

function appendSafeCommentText(element, text) {
  const tokenPattern = /(@[\p{L}\p{N}_]{1,30}|#[\p{L}\p{N}_]{1,60})/gu;
  let lastIndex = 0;
  for (const match of text.matchAll(tokenPattern)) {
    element.append(document.createTextNode(text.slice(lastIndex, match.index)));
    const token = document.createElement('span');
    token.className = 'comment-tag';
    token.textContent = match[0];
    element.appendChild(token);
    lastIndex = match.index + match[0].length;
  }
  element.append(document.createTextNode(text.slice(lastIndex)));
}

function isTrustedCommentGif(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['media.giphy.com', 'i.giphy.com', 'media.tenor.com'].includes(parsed.hostname.toLowerCase()) && /\.gif$/i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function renderCommentBody(card, comment, metadata = {}) {
  const commentText = card.querySelector('.comment-text');
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(metadata.language || '')) commentText.lang = metadata.language;
  card.querySelector('.spoiler-reveal')?.remove();
  card.querySelector('.comment-gif')?.remove();
  card.querySelector('.comment-voice-player')?.remove();
  commentText.classList.remove('spoiler-content');
  commentText.replaceChildren();
  appendSafeCommentText(commentText, comment);
  if (metadata.spoiler) {
    commentText.classList.add('spoiler-content');
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'spoiler-reveal';
    reveal.textContent = 'Show Spoiler';
    reveal.addEventListener('click', () => {
      commentText.classList.remove('spoiler-content');
      reveal.remove();
    });
    commentText.before(reveal);
  }
  if (metadata.gifUrl && isTrustedCommentGif(metadata.gifUrl)) {
    const gif = document.createElement('img');
    gif.className = 'comment-gif';
    gif.src = metadata.gifUrl;
    gif.alt = 'Comment GIF';
    gif.loading = 'lazy';
    commentText.after(gif);
  }
  if (metadata.voiceClipKey) {
    getVoiceClip(metadata.voiceClipKey).then(blob => {
      if (!card.isConnected) return;
      if (!blob) {
        const unavailable = document.createElement('small');
        unavailable.className = 'voice-status';
        unavailable.textContent = 'This voice recording is only available in the browser where it was recorded.';
        commentText.after(unavailable);
        return;
      }
      const audio = document.createElement('audio');
      audio.className = 'comment-voice-player';
      audio.controls = true;
      audio.src = URL.createObjectURL(blob);
      audio.setAttribute('aria-label', 'Voice comment');
      audio.addEventListener('error', () => {
        const unavailable = document.createElement('small');
        unavailable.className = 'voice-status';
        unavailable.textContent = 'This saved recording cannot be decoded. New recordings are saved in WAV format.';
        audio.after(unavailable);
      }, { once: true });
      (card.querySelector('.comment-gif') || commentText).after(audio);
      audio.load();
    }).catch(error => console.error('Unable to load voice comment:', error));
  }
}
