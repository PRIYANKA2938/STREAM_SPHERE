function getWatchHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(watchHistoryKey) || '[]');
    return Array.isArray(history) ? history : [];
  } catch (error) {
    return [];
  }
}

function saveWatchProgress() {
  if (!demoVideo || !demoVideo.currentTime) return;
  const title = document.querySelector('.video-title').textContent.trim();
  const currentVideoUrl = document.querySelector('.video-player').dataset.downloadUrl || videoDownloadUrl;
  const history = getWatchHistory().filter(item => item.title !== title);
  history.push({
    title,
    videoId: document.getElementById('videoId').value || 'celestial-anomaly-ep4',
    watchedAt: new Date().toISOString(),
    position: demoVideo.currentTime,
    videoUrl: currentVideoUrl
  });
  localStorage.setItem(watchHistoryKey, JSON.stringify(history.slice(-50)));
}

function renderWatchHistory() {
  const history = getWatchHistory().slice().reverse();
  historyList.innerHTML = '';
  if (!history.length) {
    historyList.innerHTML = '<p class="history-empty">No watched videos yet.</p>';
    return;
  }
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = '<video class="history-thumbnail" muted playsinline preload="metadata"></video><div class="history-item-info"><strong></strong><small></small></div>';
    row.querySelector('.history-thumbnail').src = item.videoUrl || videoDownloadUrl;
    row.querySelector('.history-item-info strong').textContent = item.title;
    row.querySelector('.history-item-info small').textContent = new Date(item.watchedAt).toLocaleString();
    row.addEventListener('click', () => openHistoryVideo(item));
    historyList.appendChild(row);
  });
}

function openHistoryVideo(item) {
  const sourceUrl = item.videoUrl || videoDownloadUrl;
  const source = document.querySelector('.video-media source');
  const player = document.querySelector('.video-player');
  document.querySelector('.video-title').textContent = item.title;
  document.getElementById('videoId').value = item.videoId || (
    item.title === 'The Celestial Anomaly - Episode 4'
      ? 'celestial-anomaly-ep4'
      : 'history-' + String(item.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  );
  loadVideoReactionState();
  player.dataset.downloadUrl = sourceUrl;
  source.src = sourceUrl;
  demoVideo.addEventListener('loadedmetadata', function restoreHistoryPosition() {
    if (Number.isFinite(Number(item.position))) demoVideo.currentTime = Number(item.position);
    demoVideo.removeEventListener('loadedmetadata', restoreHistoryPosition);
  });
  demoVideo.load();
  demoVideo.play().catch(error => console.error('Unable to play history video:', error));
  showMainVideoPage();
  player.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.getElementById('historyNavLink').addEventListener('click', event => {
  event.preventDefault();
  renderWatchHistory();
  showDestinationPage(historyPage);
});
document.getElementById('closeHistory').addEventListener('click', () => {
  showMainVideoPage();
});
function getLikedVideoHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(likedVideoHistoryKey) || '[]');
    return Array.isArray(history) ? history : [];
  } catch (error) {
    return [];
  }
}

function renderLikedVideoHistory() {
  const history = getLikedVideoHistory().slice().reverse();
  likedHistoryList.innerHTML = '';
  if (!history.length) {
    likedHistoryList.innerHTML = '<p class="history-empty">No liked videos yet.</p>';
    return;
  }
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = '<video class="history-thumbnail" muted playsinline preload="metadata"></video><div class="history-item-info"><strong></strong><small></small></div>';
    row.querySelector('.history-thumbnail').src = item.videoUrl || videoDownloadUrl;
    row.querySelector('.history-item-info strong').textContent = item.title;
    row.querySelector('.history-item-info small').textContent = new Date(item.likedAt).toLocaleString();
    row.addEventListener('click', () => openHistoryVideo(item));
    likedHistoryList.appendChild(row);
  });
}

function updateLikedVideoHistory(isLiked) {
  const videoId = document.getElementById('videoId').value || 'celestial-anomaly-ep4';
  const title = document.querySelector('.video-title').textContent.trim();
  const history = getLikedVideoHistory().filter(item => item.videoId !== videoId);
  const videoUrl = document.querySelector('.video-player').dataset.downloadUrl || videoDownloadUrl;
  if (isLiked) history.push({ videoId, title, likedAt: new Date().toISOString(), videoUrl });
  localStorage.setItem(likedVideoHistoryKey, JSON.stringify(history.slice(-50)));
}

document.getElementById('likedHistoryNavLink').addEventListener('click', event => {
  event.preventDefault();
  renderLikedVideoHistory();
  showDestinationPage(likedHistoryPage);
});
document.getElementById('closeLikedHistory').addEventListener('click', () => {
  showMainVideoPage();
});
