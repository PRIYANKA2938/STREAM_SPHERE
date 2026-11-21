function showChannelPlayback(title, videoUrl) {
  channelPage.hidden = true;
  channelWatchPage.hidden = false;
  footer.hidden = true;
  channelPlaybackTitle.textContent = title;
  channelPlaybackStatus.textContent = '';
  channelVideoSource.src = videoUrl;
  channelVideoPlayer.load();
  channelVideoPlayer.play().catch(() => {
    channelPlaybackStatus.textContent = 'Unable to play this video. Check the video source and your connection.';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

channelPage.addEventListener('click', function(event) {
  const playButton = event.target.closest('button[data-channel-video]');
  if (playButton && channelPage.contains(playButton)) {
    const videoUrl = document.querySelector('.video-player').dataset.downloadUrl;
    channelVideoPlayer.pause();
    showChannelPlayback(playButton.dataset.videoTitle, videoUrl);
    return;
  }

  const tabLink = event.target.closest('a[data-channel-tab]');
  if (!tabLink || !channelPage.contains(tabLink)) return;

  const panel = document.getElementById(tabLink.getAttribute('aria-controls'));
  if (!panel) return;
  event.preventDefault();

  channelPage.querySelectorAll('.channel-nav a').forEach(link => {
    const isActive = link.dataset.channelTab === tabLink.dataset.channelTab;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  channelPage.querySelectorAll('.channel-tab-panel').forEach(tabPanel => {
    tabPanel.hidden = tabPanel !== panel;
  });
});

if (yourChannelNavLink) {
  yourChannelNavLink.addEventListener('click', function(event) {
    event.preventDefault();
    showChannelPage();
  });
}

if (channelBackButton) {
  channelBackButton.addEventListener('click', function() {
    showMainVideoPage();
  });
}

if (channelWatchBackButton) {
  channelWatchBackButton.addEventListener('click', () => {
    stopChannelPlayback();
    channelWatchPage.hidden = true;
    channelPage.hidden = false;
    channelPage.classList.add('is-visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

