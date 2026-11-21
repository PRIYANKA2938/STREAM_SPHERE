function getLocalNotifications(ownerKey = getCommentOwnerKey()) {
  try {
    const allNotifications = JSON.parse(localStorage.getItem('streamsphereCommentNotifications') || '{}');
    return Array.isArray(allNotifications[ownerKey]) ? allNotifications[ownerKey] : [];
  } catch (error) {
    return [];
  }
}

function saveLocalNotification(ownerKey, notification) {
  try {
    const allNotifications = JSON.parse(localStorage.getItem('streamsphereCommentNotifications') || '{}');
    const notifications = Array.isArray(allNotifications[ownerKey]) ? allNotifications[ownerKey] : [];
    const notificationKey = notification.notificationId || notification.replyCommentId || notification.text + notification.timestamp;
    const existingIndex = notifications.findIndex(item =>
      (notification.notificationId && item.notificationId === notification.notificationId)
      || (notification.replyCommentId && item.replyCommentId === notification.replyCommentId)
      || (!notification.notificationId && !notification.replyCommentId && (item.notificationId || item.replyCommentId || item.text + item.timestamp) === notificationKey)
    );
    if (existingIndex >= 0) notifications[existingIndex] = { ...notifications[existingIndex], ...notification };
    else notifications.unshift(notification);
    allNotifications[ownerKey] = notifications.slice(0, 50);
    localStorage.setItem('streamsphereCommentNotifications', JSON.stringify(allNotifications));
  } catch (error) {
    console.error('Unable to save reply notification:', error);
  }
}

function renderCommentNotifications() {
  const notifications = getLocalNotifications();
  const list = document.getElementById('notificationsList');
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const badge = document.getElementById('notificationCount');
  badge.hidden = unreadCount === 0;
  badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
  list.replaceChildren();
  if (!notifications.length) {
    list.innerHTML = '<p class="notifications-empty">No reply notifications yet.</p>';
    return;
  }
  notifications.forEach(notification => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'comment-notification';
    item.dataset.commentId = notification.commentId;
    item.textContent = notification.text;
    item.style.textAlign = 'left';
    item.style.color = 'var(--body-text)';
    item.style.border = '0';
    item.addEventListener('click', () => {
      document.getElementById('notificationsPanel').hidden = true;
      document.getElementById('notificationsButton').setAttribute('aria-expanded', 'false');
      showMainVideoPage();
      document.querySelector('[data-comment-id="' + CSS.escape(notification.commentId) + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    list.appendChild(item);
  });
}

function markCommentNotificationsRead() {
  try {
    const allNotifications = JSON.parse(localStorage.getItem('streamsphereCommentNotifications') || '{}');
    allNotifications[getCommentOwnerKey()] = getLocalNotifications().map(notification => ({ ...notification, read: true }));
    localStorage.setItem('streamsphereCommentNotifications', JSON.stringify(allNotifications));
    if (localStorage.getItem('streamsphereAuthToken')) {
      requestCommentMutation('markCommentNotificationsRead', {})
        .catch(error => console.error('Unable to mark server notifications as read:', error));
    }
  } catch (error) {
    console.error('Unable to update reply notifications:', error);
  }
}

function loadServerCommentNotifications() {
  if (!localStorage.getItem('streamsphereAuthToken')) return;
  requestCommentJsonp('commentNotifications').then(response => {
    if (response.status !== 'success') return;
    const ownerKey = getCommentOwnerKey();
    (response.items || []).forEach(item => saveLocalNotification(ownerKey, {
      notificationId: item.notificationId,
      replyCommentId: item.replyCommentId,
      commentId: item.commentId,
      timestamp: item.timestamp,
      read: item.read,
      text: item.username + ' replied: ' + item.reply
    }));
    renderCommentNotifications();
  }).catch(error => console.error('Unable to load reply notifications:', error));
}

document.getElementById('notificationsButton').addEventListener('click', () => {
  const panel = document.getElementById('notificationsPanel');
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  document.getElementById('notificationsButton').setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    markCommentNotificationsRead();
    renderCommentNotifications();
  }
});
