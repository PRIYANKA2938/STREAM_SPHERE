const LOCAL_COMMENTS_KEY = 'streamsphereLocalComments';

function getViewerId() {
  let viewerId = localStorage.getItem('streamsphereViewerId');
  if (!viewerId) {
    viewerId = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'viewer-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('streamsphereViewerId', viewerId);
  }
  return viewerId;
}

function getCommentOwnerKey() {
  const sessionToken = localStorage.getItem('streamsphereAuthToken');
  const email = localStorage.getItem('streamsphereEmail');
  return sessionToken && email
    ? 'user:' + email.trim().toLowerCase()
    : 'viewer:' + getViewerId();
}

function getPublicCommentRegion(location) {
  const parts = String(location || '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(', ').slice(0, 100) : '';
}
