function closeOverflowMenu() {
  overflowPanel.classList.remove('is-open');
  overflowButton.setAttribute('aria-expanded', 'false');
}

function openReportDialog() {
  if (typeof reportDialog.showModal === 'function') {
    reportDialog.showModal();
  } else {
    reportDialog.classList.add('is-open');
  }
}

function closeReportDialog() {
  if (typeof reportDialog.close === 'function' && reportDialog.open) {
    reportDialog.close();
  }
  reportDialog.classList.remove('is-open');
}

overflowButton.addEventListener('click', function() {
  const isOpen = overflowPanel.classList.toggle('is-open');
  overflowButton.setAttribute('aria-expanded', String(isOpen));
});

overflowPanel.addEventListener('click', async function(event) {
  const actionButton = event.target.closest('[data-video-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.videoAction;
  if (action === 'share') {
    await shareVideo();
  }

  if (action === 'report') {
    openReportDialog();
    closeOverflowMenu();
    return;
  }

  if (action === 'download') {
    await downloadVideo();
    closeOverflowMenu();
    return;
  }

  if (action === 'save') {
    toggleSavedVideo(actionButton);
  }

  closeOverflowMenu();
});

document.getElementById('cancelReport').addEventListener('click', function() {
  closeReportDialog();
});

document.getElementById('reportForm').addEventListener('submit', function(event) {
  event.preventDefault();
  const reason = document.getElementById('reportReason').value;
  const details = document.getElementById('reportDetails').value.trim();
  localStorage.setItem('streamsphereVideoReport:celestial-anomaly-ep4', JSON.stringify({ reason, details }));
  closeReportDialog();
  const reportButton = document.querySelector('[data-video-action="report"]');
  if (reportButton) reportButton.lastChild.textContent = ' Reported';
  document.getElementById('reportDetails').value = '';
});

document.addEventListener('click', function(event) {
  if (!event.target.closest('.overflow-menu')) closeOverflowMenu();
});

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') closeOverflowMenu();
});
