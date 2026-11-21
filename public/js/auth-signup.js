// public/js/auth-signup.js
const signUpDialog = document.getElementById('signUpDialog');
const signUpForm = document.getElementById('signUpForm');
const signUpStatus = document.getElementById('signUpStatus');
const loginDialog = document.getElementById('loginDialog');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const signUpName = document.getElementById('signUpName');

// Preserves registered accounts so duplicate signups are permanently blocked


signUpName?.addEventListener('input', () => {
  if (typeof updatePersonalizedExperience === 'function') {
    updatePersonalizedExperience(signUpName.value);
  }
});

document.querySelectorAll('.password-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const passwordInput = document.getElementById(toggle.dataset.passwordTarget);
    if (!passwordInput) return;
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    toggle.title = isVisible ? 'Show password' : 'Hide password';
  });
});

document.getElementById('signUpButton')?.addEventListener('click', () => {
  signUpStatus.textContent = '';
  if (typeof signUpDialog.showModal === 'function') signUpDialog.showModal();
  else signUpDialog.classList.add('is-open');
});

document.getElementById('cancelSignUp')?.addEventListener('click', () => {
  if (signUpDialog.open) signUpDialog.close();
  signUpDialog.classList.remove('is-open');
  if (typeof updatePersonalizedExperience === 'function') updatePersonalizedExperience();
});

signUpDialog?.addEventListener('close', () => {
  if (typeof updatePersonalizedExperience === 'function') updatePersonalizedExperience();
});

signUpForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.getElementById('signUpEmail').value.trim().toLowerCase();
  const name = document.getElementById('signUpName').value.trim().slice(0, 40);
  const password = document.getElementById('signUpPassword').value;
  const confirmPassword = document.getElementById('signUpConfirmPassword').value;

  if (!name) {
    signUpStatus.style.color = '#ff4757';
    signUpStatus.textContent = 'Please enter a display name.';
    return;
  }
  if (!/^(?=.*\d.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
    signUpStatus.style.color = '#ff4757';
    signUpStatus.textContent = 'Password must be at least 8 characters, include 2 numbers, and include a symbol.';
    return;
  }
  if (password !== confirmPassword) {
    signUpStatus.style.color = '#ff4757';
    signUpStatus.textContent = 'Passwords do not match.';
    return;
  }

  const submitButton = signUpForm.querySelector('[type="submit"]');
  submitButton.disabled = true;

  // 1. Client-Side Check: Block if account already signed up in local storage
  const savedUsers = JSON.parse(localStorage.getItem('streamsphereUsers') || '{}');
  if (savedUsers[email]) {
    signUpStatus.style.color = '#ff4757';
    signUpStatus.textContent = 'An account with this email already exists. Please log in.';
    submitButton.disabled = false;
    return;
  }

  signUpStatus.style.color = '#f1c40f';
  signUpStatus.textContent = 'Creating your account...';

  try {
    // 2. Server-Side Check: Send registration request to backend SQLite database
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const result = await response.json();

    // If account already exists (HTTP 409) or error returned, STOP and do not sign up
    if (!response.ok || result.status !== 'success') {
      signUpStatus.style.color = '#ff4757';
      signUpStatus.textContent = result.message || 'An account with this email already exists. Please log in.';
      submitButton.disabled = false;
      return;
    }
  } catch (networkError) {
    // Offline mode: Verify again before saving
    if (savedUsers[email]) {
      signUpStatus.style.color = '#ff4757';
      signUpStatus.textContent = 'An account with this email already exists. Please log in.';
      submitButton.disabled = false;
      return;
    }
  }

  // 3. Save new account permanently into registered users store
  savedUsers[email] = { name, email, password };
  localStorage.setItem('streamsphereUsers', JSON.stringify(savedUsers));

  // 4. Set active user session
    // 4. Set active user session
  localStorage.setItem('streamsphereEmail', email);
  localStorage.setItem('streamsphereName', name);
  localStorage.setItem('streamsphereProfilePlan', 'free'); // <--- ADD THIS
  if (typeof updatePlansUI === 'function') updatePlansUI();
  if (typeof updatePersonalizedExperience === 'function') updatePersonalizedExperience();

  // Refresh downloads and buttons for the new account
  if (typeof updateDownloadButtonState === 'function') updateDownloadButtonState();
  if (typeof renderProfileDownloads === 'function') renderProfileDownloads();


  signUpStatus.style.color = '#4cd137';
  signUpStatus.textContent = 'Account created successfully! You can now log in.';
  signUpForm.reset();
  submitButton.disabled = false;

  window.setTimeout(() => {
    if (signUpDialog.open) signUpDialog.close();
    signUpDialog.classList.remove('is-open');
  }, 1200);
});

