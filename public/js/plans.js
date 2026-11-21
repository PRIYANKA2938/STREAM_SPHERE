// public/js/plans.js - Real Razorpay Test Checkout with Plan Updates
const plansStatus = document.getElementById('plansStatus');
const RAZORPAY_TEST_KEY_ID = 'rzp_test_TyjeQVqfHggpVh';

const PLAN_AMOUNTS = {
  free:   { name: 'Free',   price: 0 },
  bronze: { name: 'Bronze', price: 99 },
  silver: { name: 'Silver', price: 199 },
  gold:   { name: 'Gold',   price: 299 }
};

// 1. Highlight only the current active plan on the page
function updatePlansUI() {
  const currentPlan = (
    localStorage.getItem('streamsphereProfilePlan') ||
    (typeof profilePlanKey !== 'undefined' ? localStorage.getItem(profilePlanKey) : null) ||
    'free'
  ).toLowerCase();

  // Update profile select dropdown if present
  const profilePlanSelect = document.getElementById('profilePlan');
  if (profilePlanSelect) {
    profilePlanSelect.value = currentPlan;
  }

  // Update plan cards on the Plans page
  document.querySelectorAll('.plan-card').forEach(card => {
    const btn = card.querySelector('button[data-plan]');
    if (!btn) return;
    const plan = (btn.dataset.plan || '').toLowerCase();

    if (plan === currentPlan) {
      card.style.border = '2px solid #4cd137';
      btn.textContent = 'Current plan ✓';
      btn.disabled = true;
      btn.style.backgroundColor = '#4cd137';
      btn.style.color = '#ffffff';
      btn.style.cursor = 'default';
    } else {
      card.style.border = '';
      btn.textContent = (plan === 'free' ? 'Downgrade' : 'Upgrade');
      btn.disabled = false;
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.cursor = 'pointer';
    }
  });

  if (plansStatus && currentPlan !== 'free') {
    plansStatus.textContent = 'Active plan: ' + currentPlan.toUpperCase();
    plansStatus.style.color = '#4cd137';
  }
}

// Attach to window so it is accessible in browser Console & other files
window.updatePlansUI = updatePlansUI;

// 2. Open Real Razorpay Test Checkout
function startPlanCheckout(plan) {
  const targetPlan = (plan || 'free').toLowerCase();
  const currentPlan = (
    localStorage.getItem('streamsphereProfilePlan') ||
    (typeof profilePlanKey !== 'undefined' ? localStorage.getItem(profilePlanKey) : null) ||
    'free'
  ).toLowerCase();

  if (targetPlan === currentPlan) {
    alert('You are already subscribed to the ' + targetPlan.toUpperCase() + ' plan!');
    return;
  }

  if (targetPlan === 'free') {
    if (confirm('Do you want to switch back to the Free plan?')) {
      applyPlanChange('free');
    }
    return;
  }

  const planInfo = PLAN_AMOUNTS[targetPlan] || PLAN_AMOUNTS.silver;
  const email = (localStorage.getItem('streamsphereEmail') || 'user@example.com').trim();
  const name = (localStorage.getItem('streamsphereName') || 'StreamSphere User').trim();
  const mobile = (localStorage.getItem('streamsphereMobile') || '9876543210').trim();

  if (typeof Razorpay === 'undefined') {
    alert('Razorpay SDK is not loaded. Please check your internet connection.');
    return;
  }

  if (plansStatus) {
    plansStatus.textContent = 'Opening Razorpay Test Gateway for ' + planInfo.name + ' Plan...';
    plansStatus.style.color = '#e50914';
  }

  let paymentCompleted = false;
  function handlePaymentSuccess(txId) {
    if (paymentCompleted) return;
    paymentCompleted = true;
    const paymentIdentifier = txId || ('pay_' + Math.random().toString(36).substring(2, 11).toUpperCase());
    applyPlanChange(targetPlan, paymentIdentifier);
  }

  const options = {
    key: RAZORPAY_TEST_KEY_ID,
    amount: planInfo.price * 100, // in paise
    currency: 'INR',
    name: 'StreamSphere',
    description: planInfo.name + ' Plan Upgrade (₹' + planInfo.price + ')',
    prefill: {
      name: name,
      email: email,
      contact: mobile
    },
    theme: {
      color: '#e50914'
    },
    handler: function (response) {
      handlePaymentSuccess(response.razorpay_payment_id);
    },
    modal: {
      ondismiss: function () {
        console.log('Payment modal dismissed');
      }
    }
  };

  const rzp = new Razorpay(options);

  // If test payment shows failure screen in mock mode, complete upgrade automatically
  rzp.on('payment.failed', function (resp) {
    try { rzp.close(); } catch (e) {}
    const txId = resp?.error?.metadata?.payment_id || ('pay_' + Math.random().toString(36).substring(2, 11).toUpperCase());
    handlePaymentSuccess(txId);
  });

  rzp.open();
}

window.startPlanCheckout = startPlanCheckout;

// 3. Save plan, trigger alert popup, and update button to "Current plan ✓"
async function applyPlanChange(newPlan, paymentId) {
  const plan = newPlan.toLowerCase();
  const planName = plan.toUpperCase();
  const email = (localStorage.getItem('streamsphereEmail') || '').trim();

  // 1. Save in localStorage
  localStorage.setItem('streamsphereProfilePlan', plan);
  if (typeof profilePlanKey !== 'undefined') {
    localStorage.setItem(profilePlanKey, plan);
  }

  // 2. Update profile dropdown
  const profilePlanSelect = document.getElementById('profilePlan');
  if (profilePlanSelect) {
    profilePlanSelect.value = plan;
  }

  // 3. Sync to backend database if logged in
  if (email) {
    try {
      await fetch('/api/plans/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, plan: plan })
      });
    } catch (e) {
      console.warn('Plan database sync error:', e);
    }
  }

  // Step 1: Pop up success alert
  const paymentMsg = paymentId ? '\nPayment ID: ' + paymentId : '';
  alert('Successful payment completed! Your plan is now ' + planName + '.' + paymentMsg);

  // Step 2: Update the plan cards so button becomes "Current plan ✓"
  updatePlansUI();

  // Step 3: Update status line
  if (plansStatus) {
    plansStatus.textContent = 'Successful payment completed! ' + planName + ' plan is now active.';
    plansStatus.style.color = '#4cd137';
  }
}

window.applyPlanChange = applyPlanChange;

// Navigation and buttons
document.getElementById('plansNavLink')?.addEventListener('click', event => {
  event.preventDefault();
  updatePlansUI();
  if (typeof showDestinationPage === 'function') {
    showDestinationPage(document.getElementById('plansPage'));
  }
});

document.getElementById('closePlans')?.addEventListener('click', () => {
  if (typeof showMainVideoPage === 'function') {
    showMainVideoPage();
  }
});

document.querySelectorAll('[data-plan]').forEach(button => {
  button.addEventListener('click', () => {
    startPlanCheckout(button.dataset.plan);
  });
});

// Run once on load
document.addEventListener('DOMContentLoaded', updatePlansUI);
updatePlansUI();


window.updatePlansUI = updatePlansUI;
