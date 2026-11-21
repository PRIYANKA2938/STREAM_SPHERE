function formatVideoTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
  return minutes + ':' + remainingSeconds;
}

function updateVideoControls() {
  const duration = Number.isFinite(demoVideo.duration) ? demoVideo.duration : 0;
  videoTime.textContent = formatVideoTime(demoVideo.currentTime) + ' / ' + formatVideoTime(duration);
  videoSeek.value = duration ? String((demoVideo.currentTime / duration) * 100) : '0';
}

function seekVideo(seconds) {
  demoVideo.currentTime = Math.max(0, Math.min(demoVideo.duration || 0, demoVideo.currentTime + seconds));
  const hint = seconds < 0 ? skipBackHint : skipForwardHint;
  hint.classList.remove('is-visible');
  void hint.offsetWidth;
  hint.classList.add('is-visible');
}

function updateMuteButton() {
  videoMute.setAttribute('aria-label', demoVideo.muted || demoVideo.volume === 0 ? 'Unmute video' : 'Mute video');
  videoMute.title = demoVideo.muted || demoVideo.volume === 0 ? 'Unmute video' : 'Mute video';
  videoMute.innerHTML = demoVideo.muted || demoVideo.volume === 0
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4V5z"></path><path d="m16 9 5 6m0-6-5 6"></path></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4V5z"></path><path d="M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"></path></svg>';
}

function updatePlaybackControls() {
  const isPlaying = !demoVideo.paused && !demoVideo.ended;
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
  videoPlayPause.setAttribute('aria-label', isPlaying ? 'Pause video' : 'Play video');
  videoPlayPause.title = isPlaying ? 'Pause video' : 'Play video';
  videoPlayer.classList.toggle('is-playing', isPlaying);
}

function toggleVideoPlayback() {
  if (demoVideo.paused) {
    demoVideo.play().catch(error => {
      updatePlaybackControls();
      console.error('Unable to play video:', error);
    });
  } else {
    demoVideo.pause();
  }
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement === videoPlayer;
  videoFullscreen.setAttribute('aria-label', isFullscreen ? 'Zoom out of full screen' : 'Zoom in to full screen');
  videoFullscreen.title = isFullscreen ? 'Zoom out' : 'Zoom in';
  videoFullscreen.innerHTML = isFullscreen
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v5H3m13-5v5h5M8 21v-5H3m18 0v5h-5"></path></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"></path></svg>';
}

videoPlayPause.addEventListener('click', toggleVideoPlayback);
updatePlaybackControls();
updateFullscreenButton();

videoBack10.addEventListener('click', () => seekVideo(-10));
videoForward10.addEventListener('click', () => seekVideo(10));
videoMute.addEventListener('click', function() {
  demoVideo.muted = !demoVideo.muted;
  updateMuteButton();
});
videoVolume.addEventListener('input', function() {
  demoVideo.volume = Number(this.value);
  demoVideo.muted = demoVideo.volume === 0;
  updateMuteButton();
});
videoFullscreen.addEventListener('click', function() {
  const fullscreenTarget = document.fullscreenElement ? document.exitFullscreen() : videoPlayer.requestFullscreen?.();
  if (fullscreenTarget) fullscreenTarget.catch(error => console.error('Unable to change full screen:', error));
});
document.addEventListener('fullscreenchange', updateFullscreenButton);
videoNext.addEventListener('click', () => {
  if (typeof playNextVideo === 'function') {
    playNextVideo();
  }
});
videoSeek.addEventListener('input', function() {
  if (Number.isFinite(demoVideo.duration)) {
    demoVideo.currentTime = (Number(videoSeek.value) / 100) * demoVideo.duration;
    broadcastParty({ type: 'state', paused: demoVideo.paused, time: demoVideo.currentTime });
  }
});
demoVideo.addEventListener('loadedmetadata', updateVideoControls);
demoVideo.addEventListener('timeupdate', updateVideoControls);
demoVideo.addEventListener('loadstart', () => videoPlayer.classList.add('is-loading'));
demoVideo.addEventListener('waiting', () => videoPlayer.classList.add('is-loading'));
demoVideo.addEventListener('canplay', () => videoPlayer.classList.remove('is-loading'));
demoVideo.addEventListener('playing', () => videoPlayer.classList.remove('is-loading'));
demoVideo.addEventListener('error', () => videoPlayer.classList.remove('is-loading'));
demoVideo.addEventListener('click', toggleVideoPlayback);
demoVideo.addEventListener('play', function() {
  updatePlaybackControls();
  saveWatchProgress();
  broadcastParty({ type: 'state', paused: false, time: demoVideo.currentTime });
});
demoVideo.addEventListener('pause', function() {
  updatePlaybackControls();
  saveWatchProgress();
  broadcastParty({ type: 'state', paused: true, time: demoVideo.currentTime });
});
demoVideo.addEventListener('ended', updatePlaybackControls);
demoVideo.addEventListener('timeupdate', function() {
  if (Math.floor(demoVideo.currentTime) % 15 === 0) saveWatchProgress();
});

let lastTapTime = 0;
let lastTapX = 0;
demoVideo.addEventListener('pointerup', function(event) {
  const now = Date.now();
  const isDoubleTap = now - lastTapTime < 300 && Math.abs(event.clientX - lastTapX) < 80;
  if (isDoubleTap) {
    seekVideo(event.clientX < videoPlayer.getBoundingClientRect().left + videoPlayer.clientWidth / 2 ? -10 : 10);
    lastTapTime = 0;
    return;
  }
  lastTapTime = now;
  lastTapX = event.clientX;
});
