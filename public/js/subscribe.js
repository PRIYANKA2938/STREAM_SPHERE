const subscribeButton = document.getElementById('subscribeButton');
const channelSubscriptionButton = document.getElementById('channelSubscribeButton');
const subscribeButtons = [subscribeButton, channelSubscriptionButton].filter(Boolean);
const subscriptionKey = 'streamsphereSubscribed:streamsphere-originals';

function updateSubscribeButton() {
  const subscribed = localStorage.getItem(subscriptionKey) === 'true';
  subscribeButtons.forEach(button => {
    button.textContent = subscribed ? 'Subscribed' : 'Subscribe';
    button.classList.toggle('subscribed', subscribed);
    button.setAttribute('aria-pressed', String(subscribed));
  });
}

subscribeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const subscribed = localStorage.getItem(subscriptionKey) === 'true';
    localStorage.setItem(subscriptionKey, String(!subscribed));
    updateSubscribeButton();
  });
});
updateSubscribeButton();
