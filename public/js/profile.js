function getProfilePlan() {
  return (
    localStorage.getItem('streamsphereProfilePlan') ||
    (typeof profilePlanKey !== 'undefined' ? localStorage.getItem(profilePlanKey) : null) ||
    'free'
  ).toLowerCase();
}

function getActiveUserDownloadsKey() {
  const email = (localStorage.getItem('streamsphereEmail') || 'guest').trim().toLowerCase();
  return 'streamsphereProfileDownloads:' + email;
}

function getProfileDownloads() {
  try {
    const key = getActiveUserDownloadsKey();
    const downloads = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(downloads) ? downloads : [];
  } catch (error) {
    return [];
  }
}

// 1. Delete download option
function deleteProfileDownload(videoId, title) {
  const currentVideoId = (videoId || '').trim();
  const currentTitle = (title || '').trim().toLowerCase();
  const key = getActiveUserDownloadsKey();
  const downloads = getProfileDownloads();

  const updatedDownloads = downloads.filter(d => {
    const dId = (d.videoId || '').trim();
    const dTitle = (d.title || '').trim().toLowerCase();
    if (currentVideoId && dId && currentVideoId === dId) return false;
    if (currentTitle && dTitle && currentTitle === dTitle) return false;
    return true;
  });

  localStorage.setItem(key, JSON.stringify(updatedDownloads));
  renderProfileDownloads(updatedDownloads);

  // Reset player button from "Downloaded ✓" back to "Download"
  if (typeof updateDownloadButtonState === 'function') {
    updateDownloadButtonState();
  }

  // Background sync to delete from server database if available
  try {
    const formAction = document.getElementById('commentForm')?.action;
    if (formAction && !formAction.startsWith('file://')) {
      const userEmail = (localStorage.getItem('streamsphereEmail') || '').trim().toLowerCase();
      fetch(formAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'deleteDownload',
          email: userEmail,
          videoId: currentVideoId,
          videoTitle: title || ''
        })
      }).catch(err => console.warn('Delete download server sync:', err));
    }
  } catch (e) {}
}

window.deleteProfileDownload = deleteProfileDownload;

// 2. Render downloads with Delete (🗑️) button
function renderProfileDownloads(entries = getProfileDownloads()) {
  const lists = [document.getElementById('profileDownloads'), document.getElementById('downloadsPageList')].filter(Boolean);
  const downloads = entries;

  lists.forEach(list => {
    list.innerHTML = '';
    if (!downloads.length) {
      list.innerHTML = '<p class="empty-downloads">No downloaded videos yet.</p>';
      return;
    }

    downloads.slice().reverse().forEach((dl, index) => {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Play downloaded video: ${dl.title || 'Video'}`);
      item.innerHTML = `
        <div class="download-item-info">
          <span>${dl.title || 'Video'}</span>
          <small>${dl.date ? new Date(dl.date).toLocaleDateString() : 'Today'}</small>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <small>${(dl.plan || 'FREE').toUpperCase()} · #${index + 1}</small>
          <button type="button" class="delete-download-btn" title="Delete Download" style="background:transparent; border:none; color:#ff4757; font-size:16px; cursor:pointer; padding:4px 6px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; transition:transform 0.15s, background 0.15s;" aria-label="Delete downloaded video">
            🗑️
          </button>
        </div>
      `;

      const deleteBtn = item.querySelector('.delete-download-btn');
      deleteBtn.addEventListener('mouseenter', () => { 
        deleteBtn.style.background = 'rgba(255, 71, 87, 0.15)'; 
        deleteBtn.style.transform = 'scale(1.15)'; 
      });
      deleteBtn.addEventListener('mouseleave', () => { 
        deleteBtn.style.background = 'transparent'; 
        deleteBtn.style.transform = 'scale(1)'; 
      });

      deleteBtn.addEventListener('click', event => {
        event.stopPropagation(); // Prevents video from opening
        if (confirm(`Are you sure you want to remove "${dl.title || 'this video'}" from your downloads?`)) {
          deleteProfileDownload(dl.videoId, dl.title);
        }
      });

      const openDownload = () => {
        if (typeof openHistoryVideo !== 'function') return;
        const recommended = typeof recommendedVideoData !== 'undefined'
          ? recommendedVideoData.find(video => video.videoId === dl.videoId)
          : null;
        openHistoryVideo({
          title: dl.title || 'Video',
          videoId: dl.videoId,
          videoUrl: dl.videoUrl || recommended?.source || (typeof videoDownloadUrl !== 'undefined' ? videoDownloadUrl : ''),
          position: 0
        });
      };

      item.addEventListener('click', openDownload);
      item.addEventListener('keydown', event => {
        if (event.target === deleteBtn) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDownload();
        }
      });

      list.appendChild(item);
    });
  });
}

window.renderProfileDownloads = renderProfileDownloads;

function recordProfileDownload(videoId, title) {
  const currentVideoId = (videoId || document.getElementById('videoId')?.value || 'celestial-anomaly-ep4').trim();
  const currentTitle = (title || document.querySelector('.video-title')?.textContent || 'The Celestial Anomaly - Episode 4').trim();
  const key = getActiveUserDownloadsKey();
  const downloads = getProfileDownloads();

  const alreadyExists = downloads.some(d => 
    (d.videoId && d.videoId === currentVideoId) || 
    (d.title && d.title.toLowerCase() === currentTitle.toLowerCase())
  );

  if (!alreadyExists) {
    downloads.push({
      videoId: currentVideoId,
      title: currentTitle,
      date: new Date().toISOString(),
      plan: getProfilePlan()
    });
    localStorage.setItem(key, JSON.stringify(downloads));
  }
  renderProfileDownloads();
}

window.recordProfileDownload = recordProfileDownload;

// 3. Profile Plan dropdown setup & change listener
if (profilePlan) {
  profilePlan.disabled = false;
  profilePlan.value = getProfilePlan();

  profilePlan.addEventListener('change', () => {
    const selectedPlan = profilePlan.value.toLowerCase();
    localStorage.setItem('streamsphereProfilePlan', selectedPlan);
    if (typeof profilePlanKey !== 'undefined') {
      localStorage.setItem(profilePlanKey, selectedPlan);
    }
    if (typeof updatePlansUI === 'function') {
      updatePlansUI();
    }
    const email = (localStorage.getItem('streamsphereEmail') || '').trim();
    if (email) {
      fetch('/api/plans/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: selectedPlan })
      }).catch(err => console.warn('Plan sync:', err));
    }
  });
}

async function loadAuthenticatedProfile() {
  const token = localStorage.getItem('streamsphereAuthToken') || '';
  if (!token) return;
  try {
    const response = await fetch('/api/profile', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const result = await response.json();
    if (response.ok && result.status === 'success' && result.profile) {
      const profile = result.profile;
      if (profile.theme) { profileTheme.value = profile.theme; localStorage.setItem('streamsphereThemePreference', profile.theme); }
      if (profile.plan) { 
        if (profilePlan) profilePlan.value = profile.plan; 
        localStorage.setItem('streamsphereProfilePlan', profile.plan);
        if (typeof profilePlanKey !== 'undefined') localStorage.setItem(profilePlanKey, profile.plan);
      }
      if (profile.email) { profileEmail.value = profile.email; localStorage.setItem('streamsphereEmail', profile.email); }
      if (profile.mobile) { profileMobile.value = profile.mobile; localStorage.setItem('streamsphereMobile', profile.mobile); }
      if (profile.location) { profileLocation.value = profile.location; localStorage.setItem('streamsphereLocation', profile.location); }
      applyThemePreference(profileTheme.value, false);
      if (typeof updatePlansUI === 'function') updatePlansUI();
    }
  } catch (error) {
    console.warn('Profile sync using local storage:', error);
  }
}

async function saveProfileSettings() {
  const theme = profileTheme.value;
  const mobile = profileMobile.value.trim();
  const location = profileLocation.value.trim();
  localStorage.setItem('streamsphereThemePreference', theme);
  localStorage.setItem('streamsphereMobile', mobile);
  localStorage.setItem('streamsphereLocation', location);
  applyThemePreference(theme);

  const statusElem = document.getElementById('profileSecurityStatus');
  if (statusElem) statusElem.textContent = 'Profile settings saved.';

  const token = localStorage.getItem('streamsphereAuthToken') || '';
  if (!token) return;

  try {
    fetch('/api/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ theme, mobile, location })
    }).catch(err => console.warn('Profile server sync:', err));
  } catch (error) {}
}

async function loadDownloadHistory() {
  try {
    const formAction = document.getElementById('commentForm')?.action;
    if (!formAction || formAction.startsWith('file://')) return;
    const userEmail = (localStorage.getItem('streamsphereEmail') || '').trim().toLowerCase();

    const response = await fetch(formAction, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'getDownloadHistory',
        email: userEmail,
        viewerId: typeof getViewerId === 'function' ? getViewerId() : 'anonymous'
      })
    });
    const data = await response.json();
    if (response.ok && data.status === 'success' && Array.isArray(data.history)) {
      renderProfileDownloads(data.history);
    } else {
      throw new Error(data.message || 'Unable to load download history.');
    }
  } catch (error) {
    console.warn('Unable to load download history from server, using local history:', error);
    renderProfileDownloads();
  }
}

function showDownloadsPage() {
  renderProfileDownloads();
  showDestinationPage(document.getElementById('downloadsPage'));
  loadDownloadHistory();
}

document.getElementById('downloadsNavLink')?.addEventListener('click', event => {
  event.preventDefault();
  showDownloadsPage();
});

profileTheme.addEventListener('change', saveProfileSettings);
profileMobile.addEventListener('change', () => localStorage.setItem('streamsphereMobile', profileMobile.value.trim()));
profileLocation.addEventListener('change', () => localStorage.setItem('streamsphereLocation', profileLocation.value.trim()));
document.getElementById('saveProfile')?.addEventListener('click', saveProfileSettings);

// Open profile modal & populate current values
document.getElementById('profileButton')?.addEventListener('click', async function() {
  profileTheme.value = localStorage.getItem('streamsphereThemePreference')
    || localStorage.getItem('streamsphereTheme')
    || 'auto';
  profileEmail.value = localStorage.getItem('streamsphereEmail') || '';
  profileMobile.value = localStorage.getItem('streamsphereMobile') || '';
  profileLocation.value = localStorage.getItem('streamsphereLocation') || '';
  
  if (profilePlan) {
    profilePlan.value = getProfilePlan();
  }

  document.getElementById('profileSecurityStatus').textContent = 'New browsers/devices or changed sign-in regions require a code sent to your registered email. City/state is based on your saved profile location; precise location is not collected.';
  if (typeof profileDialog.showModal === 'function') profileDialog.showModal();
  else profileDialog.classList.add('is-open');
  await loadAuthenticatedProfile();
});

document.getElementById('closeDownloads')?.addEventListener('click', showMainVideoPage);
document.getElementById('closeProfile')?.addEventListener('click', function() {
  if (typeof profileDialog.close === 'function' && profileDialog.open) profileDialog.close();
  profileDialog.classList.remove('is-open');
});

// Log out functionality
document.getElementById('logoutButton')?.addEventListener('click', function() {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('streamsphereAuthToken');
    localStorage.removeItem('streamsphereEmail');
    localStorage.removeItem('streamsphereName');
    localStorage.removeItem('streamsphereMobile');
    localStorage.removeItem('streamsphereLocation');
    localStorage.removeItem('streamsphereProfilePlan');

    if (profileEmail) profileEmail.value = '';
    if (profileMobile) profileMobile.value = '';
    if (profileLocation) profileLocation.value = '';
    if (profilePlan) profilePlan.value = 'free';

    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = '';
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.value = '';

    if (typeof profileDialog.close === 'function' && profileDialog.open) {
      profileDialog.close();
    }
    profileDialog.classList.remove('is-open');

    alert('You have been logged out successfully.');
    window.location.reload();
  }
});
