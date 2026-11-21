function sortCommentCards(mode = 'relevant') {
  const list = document.getElementById('commentsList');
  const cards = [...list.querySelectorAll('.comment-card')];
  const score = card => {
    const likes = Number(card.querySelector('.reaction-btn[data-reaction="like"] span')?.textContent.replace(/,/g, '') || 0);
    const votes = getUsefulVoteState(card.dataset.commentId);
    const replies = card.querySelectorAll('.reply-item').length;
    return (card.dataset.isPinned === 'true' ? 100000 : 0) + likes + votes.up * 3 - votes.down + replies * 2;
  };
  const timestampValue = card => {
    const timestamp = card.querySelector('[data-timestamp]')?.dataset.timestamp;
    if (timestamp) return new Date(timestamp).getTime() || 0;
    const age = card.querySelector('.timestamp')?.textContent.toLowerCase().match(/(\d+)\s+(min|hour|day|week|month|year)s? ago/);
    if (!age) return 0;
    const duration = { min: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 }[age[2]];
    return Date.now() - Number(age[1]) * duration;
  };
  cards.sort((a, b) => {
    if (mode === 'newest') {
      return timestampValue(b) - timestampValue(a);
    }
    if (mode === 'liked') {
      const aLikes = Number(a.querySelector('.reaction-btn[data-reaction="like"] span')?.textContent.replace(/,/g, '') || 0);
      const bLikes = Number(b.querySelector('.reaction-btn[data-reaction="like"] span')?.textContent.replace(/,/g, '') || 0);
      return bLikes - aLikes;
    }
    return score(b) - score(a);
  });
  cards.forEach(card => list.appendChild(card));
}

document.getElementById('commentSort').addEventListener('change', event => sortCommentCards(event.target.value));
const commentViewFilters = { language: 'all', bookmark: 'all' };
function applyCommentViewFilters() {
  const bookmarks = new Set(JSON.parse(localStorage.getItem('streamsphereBookmarkedComments') || '[]'));
  document.querySelectorAll('#commentsList .comment-card').forEach(card => {
    const matchesLanguage = commentViewFilters.language === 'all'
      || (commentViewFilters.language === 'other' ? !['en', 'ta', 'hi', 'es'].includes(card.dataset.language) : card.dataset.language === commentViewFilters.language);
    const matchesBookmark = commentViewFilters.bookmark === 'all' || bookmarks.has(card.dataset.commentId);
    card.hidden = !matchesLanguage || !matchesBookmark;
  });
}
document.getElementById('commentLanguageFilter').addEventListener('change', event => {
  commentViewFilters.language = event.target.value;
  applyCommentViewFilters();
});
document.getElementById('commentBookmarkFilter').addEventListener('change', event => {
  commentViewFilters.bookmark = event.target.value;
  applyCommentViewFilters();
});
