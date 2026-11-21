const mainPage = document.querySelector('main.page');
const channelPage = document.getElementById('channelPage');
const channelWatchPage = document.getElementById('channelWatchPage');
const channelPlayback = document.getElementById('channelPlayback');
const channelVideoPlayer = document.getElementById('channelVideoPlayer');
const channelVideoSource = channelVideoPlayer.querySelector('source');
const channelPlaybackTitle = document.getElementById('channelPlaybackTitle');
const channelPlaybackStatus = document.getElementById('channelPlaybackStatus');
const destinationPages = Array.from(document.querySelectorAll('.destination-page'));
const footer = document.querySelector('footer');
const yourChannelNavLink = document.getElementById('yourChannelNavLink');
const channelBackButton = document.getElementById('channelBackButton');
const channelWatchBackButton = document.getElementById('channelWatchBackButton');
const channelSubscribeButton = document.getElementById('channelSubscribeButton');

function stopChannelPlayback() {
  channelVideoPlayer.pause();
  channelVideoSource.removeAttribute('src');
  channelPlaybackTitle.textContent = '';
  channelPlaybackStatus.textContent = '';
  channelVideoPlayer.load();
}

function showMainVideoPage() {
  stopChannelPlayback();
  channelWatchPage.hidden = true;
  if (mainPage) mainPage.hidden = false;
  if (channelPage) channelPage.hidden = true;
  channelPage && channelPage.classList.remove('is-visible');
  destinationPages.forEach(page => { page.hidden = true; });
  if (footer) footer.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDestinationPage(page) {
  stopChannelPlayback();
  channelWatchPage.hidden = true;
  if (mainPage) mainPage.hidden = true;
  if (channelPage) channelPage.hidden = true;
  channelPage && channelPage.classList.remove('is-visible');
  destinationPages.forEach(destination => { destination.hidden = destination !== page; });
  if (footer) footer.hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showChannelPage() {
  stopChannelPlayback();
  channelWatchPage.hidden = true;
  if (mainPage) mainPage.hidden = true;
  destinationPages.forEach(page => { page.hidden = true; });
  if (channelPage) {
    channelPage.hidden = false;
    channelPage.classList.add('is-visible');
  }
  if (footer) footer.hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
