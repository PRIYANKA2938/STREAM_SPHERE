// public/js/video-actions.js

function updateSaveLabel(button, isSaved) {
  const textNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = isSaved ? ' Saved' : ' Save';
  button.setAttribute('aria-label', isSaved ? 'Remove video from saved items' : 'Save this video');
}

function toggleSavedVideo(button) {
  const isSaved = localStorage.getItem(savedVideoKey) === 'true';
  const nextSavedState = !isSaved;
  localStorage.setItem(savedVideoKey, String(nextSavedState));
  document.querySelectorAll('.save-video-action, [data-video-action="save"]').forEach(saveButton => updateSaveLabel(saveButton, nextSavedState));
}

function shareVideo() {
  const dialog = document.getElementById('shareDialog');
  const linkInput = document.getElementById('shareLinkInput');
  const copyBtn = document.getElementById('copyShareLinkBtn');
  const currentUrl = window.location.href;
  const title = encodeURIComponent(document.title || 'Check out this video on StreamSphere!');
  const encodedUrl = encodeURIComponent(currentUrl);

  if (linkInput) linkInput.value = currentUrl;

  // Set social share links
  const wa = document.getElementById('shareWhatsApp');
  if (wa) wa.href = `https://api.whatsapp.com/send?text=${title}%20${encodedUrl}`;
  const tw = document.getElementById('shareTwitter');
  if (tw) tw.href = `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`;
  const fb = document.getElementById('shareFacebook');
  if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const em = document.getElementById('shareEmail');
  if (em) em.href = `mailto:?subject=${title}&body=Watch%20this%20video:%20${encodedUrl}`;

  // Copy button logic
  if (copyBtn) {
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(currentUrl);
      } catch (e) {
        if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
        }
      }
      copyBtn.textContent = 'Copied! ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    };
  }

  const closeBtn = document.getElementById('closeShareDialog');
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.classList.remove('is-open');
    };
  }

  if (dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.classList.add('is-open');
  }
}

document.querySelector('.share-video-action')?.addEventListener('click', shareVideo);
document.querySelector('.save-video-action')?.addEventListener('click', function() {
  toggleSavedVideo(this);
});

const initiallySaved = localStorage.getItem(savedVideoKey) === 'true';
document.querySelectorAll('.save-video-action, [data-video-action="save"]').forEach(saveButton => updateSaveLabel(saveButton, initiallySaved));

// Safely detect current active video URL
function getActiveVideoDownloadUrl() {
  const player = document.querySelector('.video-player');
  const source = document.querySelector('.video-media source') || document.querySelector('.video-media');
  return (player && player.dataset && player.dataset.downloadUrl)
    || (source && source.src)
    || (typeof videoDownloadUrl !== 'undefined' && videoDownloadUrl)
    || 'https://images-assets.nasa.gov/video/Apollo_11_Introduction_720p/Apollo_11_Introduction_720p~medium.mp4';
}

// Check if active video was already downloaded for this account
// Check ONLY if THIS exact active video was downloaded by the current account
function isCurrentVideoDownloaded() {
  const activeVideoId = (document.getElementById('videoId')?.value || '').trim();
  const activeTitle = (document.querySelector('.video-title')?.textContent || '').trim().toLowerCase();
  const downloads = typeof getProfileDownloads === 'function' ? getProfileDownloads() : [];

  if (!downloads.length) return false;

  return downloads.some(d => {
    const dId = (d.videoId || '').trim();
    const dTitle = (d.title || '').trim().toLowerCase();

    if (activeVideoId && dId && activeVideoId === dId) return true;
    if (activeTitle && dTitle && activeTitle === dTitle) return true;
    return false;
  });
}

// Reset button to normal "Download" or green "Downloaded ✓"
function updateDownloadButtonState() {
  const isDownloaded = isCurrentVideoDownloaded();
  document.querySelectorAll('.download-video-action, [data-video-action="download"]').forEach(btn => {
    if (isDownloaded) {
      btn.style.color = '#4cd137';
      btn.style.borderColor = '#4cd137';
      const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (textNode) textNode.textContent = ' Downloaded ✓';
    } else {
      btn.style.color = '';
      btn.style.borderColor = '';
      const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (textNode) textNode.textContent = ' Download';
    }
  });
}

window.updateDownloadButtonState = updateDownloadButtonState;

async function downloadVideo() {
  const url = getActiveVideoDownloadUrl();
  const videoId = document.getElementById('videoId')?.value || 'celestial-anomaly-ep4';
  const videoTitle = document.querySelector('.video-title')?.textContent.trim() || 'The Celestial Anomaly - Episode 4';
  const userEmail = (localStorage.getItem('streamsphereEmail') || '').trim().toLowerCase();

  // 1. Require logged in user so downloads are strictly isolated per account
  if (!userEmail) {
    alert('Please log in or sign up first so downloads are saved to your account!');
    const loginButton = document.getElementById('loginButton');
    if (loginButton) loginButton.click();
    return;
  }

  // 2. Check if THIS specific account already downloaded this video
  if (isCurrentVideoDownloaded()) {
    alert('You have already downloaded this video on this account!');
    return;
  }


  // 2. Daily Plan Limit Check
  const currentPlan = (localStorage.getItem('streamsphereProfilePlan') || (typeof profilePlanKey !== 'undefined' ? localStorage.getItem(profilePlanKey) : null) || 'free').toLowerCase();
  const PLAN_LIMITS = { free: 1, bronze: 3, silver: 10, gold: 50 };
  const dailyLimit = PLAN_LIMITS[currentPlan] || 1;
  const today = new Date().toISOString().slice(0, 10);

  const existingDownloads = typeof getProfileDownloads === 'function' ? getProfileDownloads() : [];
  const downloadsToday = existingDownloads.filter(d => d.date && d.date.startsWith(today)).length;

  if (downloadsToday >= dailyLimit) {
    alert(`Your ${currentPlan.toUpperCase()} plan allows ${dailyLimit} download(s) per day. Upgrade your plan for more!`);
    return;
  }

  // 3. Backend Authorization (if server is running)
  const formAction = document.getElementById('commentForm')?.action;
  if (formAction && !formAction.startsWith('file://')) {
    try {
      const res = await fetch(formAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'authorizeDownload',
          email: userEmail,
          viewerId: typeof getViewerId === 'function' ? getViewerId() : 'anonymous',
          plan: currentPlan,
          videoId: videoId,
          videoTitle: videoTitle
        })
      });
      const data = await res.json();
      if (data && data.status === 'denied') {
        alert(data.message || `Your ${currentPlan.toUpperCase()} plan daily limit reached.`);
        return;
      }
    } catch (e) {
      console.warn('Backend server offline, using local quota enforcement.');
    }
  }

  // 4. Trigger file download to user's device
  const filename = 'celestial-anomaly-episode-4.mp4';
  try {
    if (window.location.protocol.startsWith('http')) {
      // Stream through backend attachment route
      const link = document.createElement('a');
      link.href = `/api/download?filename=${encodeURIComponent(filename)}&url=${encodeURIComponent(url)}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      // Direct browser fallback for file:// protocol
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    // 5. Save in Profile downloads history and change button to "Downloaded ✓"
    if (typeof recordProfileDownload === 'function') {
      recordProfileDownload(videoId, videoTitle);
    }
    updateDownloadButtonState();

    alert(`✓ Video downloaded successfully!\nDaily quota: ${downloadsToday + 1}/${dailyLimit} used on ${currentPlan.toUpperCase()} plan.`);
  } catch (err) {
    console.error('Download error:', err);
    window.open(url, '_blank');
  }
}

// Connect click events to all download buttons
document.querySelectorAll('.download-video-action, [data-video-action="download"]').forEach(btn => {
  btn.addEventListener('click', downloadVideo);
});

// Update button state on initial page load
document.addEventListener('DOMContentLoaded', updateDownloadButtonState);
setTimeout(updateDownloadButtonState, 500);
