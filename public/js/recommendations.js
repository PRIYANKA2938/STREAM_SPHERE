let currentVideoIndex = 0;

const recommendedVideoData = [
  {
    videoId: 'apollo-11-overview',
    title: 'Apollo 11 Mission: Historic Journey',
    duration: '02:18',
    source: 'https://images-assets.nasa.gov/video/Apollo_11_Introduction_720p/Apollo_11_Introduction_720p~medium.mp4'
  },
  {
    videoId: 'trades-in-space',
    title: 'Trades in Space: Daily Astronaut Science',
    duration: '02:35',
    source: 'https://images-assets.nasa.gov/video/MSFC_10112024_Trades%20in%20Space/MSFC_10112024_Trades%20in%20Space~medium.mp4'
  },
  {
    videoId: 'olympics-space-station',
    title: 'Zero-G Sports: Life on the Space Station',
    duration: '02:13',
    source: 'https://images-assets.nasa.gov/video/Olympics%20on%20the%20International%20Space%20Station/Olympics%20on%20the%20International%20Space%20Station~medium.mp4'
  },
  {
    videoId: 'perseverance-mars-touchdown',
    title: 'Perseverance Rover: Descent & Landing on Mars',
    duration: '03:25',
    source: 'https://images-assets.nasa.gov/video/JPL-20210222-M2020f-0001-Perseverance%20Rover%E2%80%99s%20Descent%20and%20Touchdown%20on%20Mars/JPL-20210222-M2020f-0001-Perseverance%20Rover%E2%80%99s%20Descent%20and%20Touchdown%20on%20Mars~medium.mp4'
  },
  {
    videoId: 'lunar-weather-mystery',
    title: 'Deep Space Mysteries: Weather on the Moon',
    duration: '01:29',
    source: 'https://images-assets.nasa.gov/video/Is%20There%20Weather%20on%20the%20Moon/Is%20There%20Weather%20on%20the%20Moon~medium.mp4'
  },
  {
    videoId: 'artemis-go-forward',
    title: 'Project Artemis: Next Giant Leap',
    duration: '01:21',
    source: 'https://images-assets.nasa.gov/video/NHQ_2019_0311_Go%20Forward%20to%20the%20Moon/NHQ_2019_0311_Go%20Forward%20to%20the%20Moon~medium.mp4'
  }
];

function loadRecommendedVideo(card) {
  const cards = Array.from(document.querySelectorAll('.reco-item'));
  const index = cards.indexOf(card);
  if (index === -1) return;
  currentVideoIndex = index;

  const video = recommendedVideoData[index];
  if (!video) return;

  const titleEl = document.querySelector('.video-title');
  const statsEl = document.querySelector('.video-stats');
  const playerEl = document.querySelector('.video-player');
  const videoIdInput = document.getElementById('videoId');
  const source = demoVideo.querySelector('source');

  if (titleEl) titleEl.textContent = video.title;
  if (statsEl) statsEl.textContent = 'Recommended for you · ' + video.duration;
  if (playerEl) playerEl.dataset.downloadUrl = video.source;
  if (videoIdInput) videoIdInput.value = video.videoId;

      // Refresh download button state for the new video
  if (typeof updateDownloadButtonState === 'function') {
    updateDownloadButtonState();
  }

  // Update source & direct video src for reliable cross-browser playback
  if (source) source.src = video.source;
  demoVideo.src = video.source;
  demoVideo.load();

  const playPromise = demoVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn('Autoplay waiting for user interaction:', error);
    });
  }
   async function playPreviousVideo() {
  const cards = Array.from(document.querySelectorAll('.reco-item'));
  if (!cards.length) return;

  // Move sequentially to the previous (before) video
  currentVideoIndex = (currentVideoIndex - 1 + cards.length) % cards.length;
  loadRecommendedVideo(cards[currentVideoIndex]);
}

// Bind click event for the Before / Previous video button
document.getElementById('videoPrev')?.addEventListener('click', playPreviousVideo);

  if (playerEl) playerEl.classList.add('is-loading');
  cards.forEach(item => item.classList.remove('is-next-selected'));
  card.classList.add('is-next-selected');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function playNextVideo() {
  const cards = Array.from(document.querySelectorAll('.reco-item'));
  if (!cards.length) return;

  // Move sequentially to the next video
  currentVideoIndex = (currentVideoIndex + 1) % cards.length;
  loadRecommendedVideo(cards[currentVideoIndex]);
}

document.querySelectorAll('.reco-item').forEach(card => {
  card.addEventListener('click', () => loadRecommendedVideo(card));
});
