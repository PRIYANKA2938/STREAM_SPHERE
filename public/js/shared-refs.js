// Video overflow actions
const overflowButton = document.getElementById('overflowButton');
const overflowPanel = document.getElementById('overflowPanel');
const reportDialog = document.getElementById('reportDialog');
const savedVideoKey = 'streamsphereSavedVideo:celestial-anomaly-ep4';
const videoDownloadUrl = document.querySelector('.video-player').dataset.downloadUrl || '';
const profilePlanKey = 'streamsphereProfilePlan';

// Helper to get active user's email or 'guest'
function getActiveUserEmail() {
  const email = (localStorage.getItem('streamsphereEmail') || '').trim().toLowerCase();
  return email ? email : 'guest';
}

// Separate storage key for every user account
function getProfileDownloadsKey() {
  return 'streamsphereProfileDownloads:' + getActiveUserEmail();
}
function getWatchHistoryKey() {
  return 'streamsphereWatchHistory:' + getActiveUserEmail();
}
function getLikedVideoHistoryKey() {
  return 'streamsphereLikedVideoHistory:' + getActiveUserEmail();
}

// Dynamic properties so existing code automatically uses the logged-in user's key
Object.defineProperty(window, 'profileDownloadsKey', {
  get: () => getProfileDownloadsKey(),
  configurable: true
});
Object.defineProperty(window, 'watchHistoryKey', {
  get: () => getWatchHistoryKey(),
  configurable: true
});
Object.defineProperty(window, 'likedVideoHistoryKey', {
  get: () => getLikedVideoHistoryKey(),
  configurable: true
});

const profileDialog = document.getElementById('profileDialog');
const profilePlan = document.getElementById('profilePlan');
const profileTheme = document.getElementById('profileTheme');
const profileEmail = document.getElementById('profileEmail');
const profileMobile = document.getElementById('profileMobile');
const profileLocation = document.getElementById('profileLocation');
const historyPage = document.getElementById('historyPage');
const historyList = document.getElementById('historyList');
const likedHistoryPage = document.getElementById('likedHistoryPage');
const likedHistoryList = document.getElementById('likedHistoryList');
