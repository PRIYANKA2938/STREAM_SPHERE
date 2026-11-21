let pendingLoginChallengeId = '';
let loginOtpResendTimer = 0;

function startLoginOtpCooldown() {
  const resendButton = document.getElementById('resendLoginOtp');
  window.clearTimeout(loginOtpResendTimer);
  resendButton.disabled = true;
  loginOtpResendTimer = window.setTimeout(() => {
    resendButton.disabled = false;
    loginOtpResendTimer = 0;
  }, 60000);
}

function resetLoginVerification() {
  pendingLoginChallengeId = '';
  window.clearTimeout(loginOtpResendTimer);
  loginOtpResendTimer = 0;
  document.getElementById('resendLoginOtp').disabled = false;
  document.getElementById('loginCredentials').hidden = false;
  document.getElementById('loginOtpStep').hidden = true;
  document.getElementById('loginEmail').disabled = false;
  document.getElementById('loginPassword').disabled = false;
  const codeInput = document.getElementById('loginOtpCode');
  codeInput.disabled = true;
  codeInput.value = '';
  document.getElementById('loginSubmit').textContent = 'Log in';
  document.getElementById('loginDescription').textContent = 'Use the email and password from your StreamSphere account.';
}

function loginRegion() {
  const savedLocation = localStorage.getItem('streamsphereLocation') || '';
  const region = getPersonalizedRegion();
  return [savedLocation.trim() || region.region, region.timeZone, region.locale].join(' · ');
}

async function submitLoginRequest(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || (result.status !== 'success' && result.status !== 'otp_required')) {
    throw new Error(result.message || 'Unable to sign in.');
  }
  return result;
}

function finishLogin(result) {
  const user = result.user;
  localStorage.setItem('streamsphereAuthToken', result.token);
  localStorage.setItem('streamsphereEmail', user.email);
  localStorage.setItem('streamsphereName', user.name);
  localStorage.setItem('streamsphereMobile', user.mobile || '');
  if (user.location) localStorage.setItem('streamsphereLocation', user.location);
  localStorage.setItem('streamsphereThemePreference', user.theme || 'auto');

  const usernameInput = document.getElementById('username');
  if (usernameInput) usernameInput.value = user.name;
  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.value = user.email;

  applyThemePreference(user.theme || 'auto');
  updatePersonalizedExperience(user.name);
  loginStatus.style.color = '#4cd137';
  loginStatus.textContent = 'Login successful! Welcome, ' + user.name + '.';
  resetLoginVerification();
  loginForm.reset();
  window.setTimeout(() => {
    if (loginDialog.open) loginDialog.close();
    loginDialog.classList.remove('is-open');
  }, 1200);
    if (typeof updatePlansUI === 'function') updatePlansUI();
  if (typeof updateDownloadButtonState === 'function') updateDownloadButtonState();
  if (typeof renderProfileDownloads === 'function') renderProfileDownloads();
}

document.getElementById('loginButton')?.addEventListener('click', () => {
  resetLoginVerification();
  loginStatus.textContent = '';
  document.getElementById('loginEmail').value = localStorage.getItem('streamsphereEmail') || '';
  document.getElementById('loginPassword').value = '';
  if (typeof loginDialog.showModal === 'function') loginDialog.showModal();
  else loginDialog.classList.add('is-open');
});

document.getElementById('cancelLogin')?.addEventListener('click', () => {
  resetLoginVerification();
  loginForm.reset();
  if (loginDialog.open) loginDialog.close();
  loginDialog.classList.remove('is-open');
});

document.getElementById('resendLoginOtp')?.addEventListener('click', async () => {
  if (!pendingLoginChallengeId) return;
  const resendButton = document.getElementById('resendLoginOtp');
  resendButton.disabled = true;
  try {
    const result = await submitLoginRequest('/api/auth/resend-otp', { challengeId: pendingLoginChallengeId });
    loginStatus.style.color = '#4cd137';
    loginStatus.textContent = result.message;
  } catch (error) {
    loginStatus.style.color = '#ff4757';
    loginStatus.textContent = error.message || 'Unable to resend the verification code.';
  } finally {
    startLoginOtpCooldown();
  }
});

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = document.getElementById('loginSubmit');
  submitButton.disabled = true;
  loginStatus.style.color = 'var(--body-text)';
  loginStatus.textContent = pendingLoginChallengeId ? 'Verifying code...' : 'Checking account...';

  try {
    if (pendingLoginChallengeId) {
      const result = await submitLoginRequest('/api/auth/verify-otp', {
        challengeId: pendingLoginChallengeId,
        code: document.getElementById('loginOtpCode').value.trim()
      });
      finishLogin(result);
      return;
    }

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const region = loginRegion();

    try {
      const result = await submitLoginRequest('/api/login', {
        email,
        password,
        region,
        deviceKey: getDeviceTrustKey(region)
      });
      if (result.status === 'otp_required') {
        pendingLoginChallengeId = result.challengeId;
        document.getElementById('loginOtpDestination').textContent = result.destination;
        document.getElementById('loginCredentials').hidden = true;
        document.getElementById('loginEmail').disabled = true;
        document.getElementById('loginPassword').disabled = true;
        document.getElementById('loginOtpStep').hidden = false;
        const codeInput = document.getElementById('loginOtpCode');
        codeInput.disabled = false;
        codeInput.focus();
        startLoginOtpCooldown();
        document.getElementById('loginDescription').textContent = 'Confirm this new device or location to finish signing in.';
        submitButton.textContent = 'Verify and sign in';
        loginStatus.style.color = 'var(--body-text)';
        loginStatus.textContent = 'A one-time code is required for this sign-in.';
        return;
      }
      finishLogin(result);
    } catch (networkError) {
      // Fallback: Check local registered account if backend is offline
      const users = JSON.parse(localStorage.getItem('streamsphereUsers') || '{}');
      const localUser = users[email];

      if (localUser && localUser.password !== password) {
        loginStatus.style.color = '#ff4757';
        loginStatus.textContent = 'Incorrect password. Please try again.';
        submitButton.disabled = false;
        return;
      }

      const displayName = localUser ? localUser.name : email.split('@')[0];
      finishLogin({
        token: 'local_token_' + Date.now(),
        user: { name: displayName, email: email, theme: 'auto' }
      });
    }
  } finally {
    submitButton.disabled = false;
  }
});


