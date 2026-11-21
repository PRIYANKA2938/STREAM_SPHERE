document.getElementById('gifStickerButton').addEventListener('click', event => {
  const panel = document.getElementById('gifStickerPanel');
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
});

document.querySelectorAll('[data-sticker]').forEach(button => {
  button.addEventListener('click', () => {
    const sticker = button.dataset.sticker;
    const start = commentTextInput.selectionStart;
    commentTextInput.setRangeText(sticker, start, commentTextInput.selectionEnd, 'end');
    commentTextInput.focus();
  });
});

document.getElementById('insertGifButton').addEventListener('click', () => {
  const input = document.getElementById('commentGifInput');
  try {
    const gifUrl = new URL(input.value.trim());
    const trustedHost = ['media.giphy.com', 'i.giphy.com', 'media.tenor.com'].includes(gifUrl.hostname.toLowerCase());
    if (gifUrl.protocol !== 'https:' || !trustedHost || !/\.gif$/i.test(gifUrl.pathname)) throw new Error('unsupported');
    commentGifUrlInput.value = gifUrl.href;
    commentTextInput.required = false;
    voiceCommentStatus.textContent = 'GIF attached to your comment.';
    document.getElementById('gifStickerPanel').hidden = true;
    document.getElementById('gifStickerButton').setAttribute('aria-expanded', 'false');
  } catch (error) {
    input.setCustomValidity('Use a direct HTTPS GIF from GIPHY or Tenor.');
    input.reportValidity();
    input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
  }
});

commentTextInput.addEventListener('input', () => {
  document.getElementById('commentCharacterCount').textContent = commentTextInput.value.length.toLocaleString() + ' / 5,000';
  const atMatch = commentTextInput.value.slice(0, commentTextInput.selectionStart).match(/(?:^|\s)@([\w]{1,30})$/);
  const suggestions = document.getElementById('mentionSuggestions');
  suggestions.replaceChildren();
  if (!atMatch) {
    suggestions.hidden = true;
    return;
  }
  const query = atMatch[1].toLowerCase();
  const names = [...new Set([...document.querySelectorAll('.comment-card .username')].map(node => node.textContent.trim()).filter(name => name && name.toLowerCase().includes(query)))].slice(0, 5);
  names.forEach(name => {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = '@' + name;
    option.addEventListener('click', () => {
      const cursor = commentTextInput.selectionStart;
      const mentionStart = cursor - atMatch[1].length - 1;
      commentTextInput.setRangeText('@' + name + ' ', mentionStart, cursor, 'end');
      suggestions.hidden = true;
      commentTextInput.focus();
    });
    suggestions.appendChild(option);
  });
  suggestions.hidden = !names.length;
});
