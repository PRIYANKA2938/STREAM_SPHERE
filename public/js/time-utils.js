function formatRelativeTime(timestamp) {
  const createdAt = new Date(timestamp).getTime();
  if (!Number.isFinite(createdAt)) return 'just now';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (elapsedSeconds < 60) return 'just now';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return elapsedMinutes + (elapsedMinutes === 1 ? ' min ago' : ' mins ago');
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return elapsedHours + (elapsedHours === 1 ? ' hour ago' : ' hours ago');
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return elapsedDays + (elapsedDays === 1 ? ' day ago' : ' days ago');
  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return elapsedMonths + (elapsedMonths === 1 ? ' month ago' : ' months ago');
  const elapsedYears = Math.floor(elapsedDays / 365);
  return elapsedYears + (elapsedYears === 1 ? ' year ago' : ' years ago');
}

function updateRelativeTimestamps() {
  document.querySelectorAll('[data-timestamp]').forEach(timestampElement => {
    timestampElement.textContent = '\u2022 ' + formatRelativeTime(timestampElement.dataset.timestamp);
  });
}
