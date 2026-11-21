// Mobile menu
const navLinks = document.querySelector('.nav-links');
navLinks?.addEventListener('click', function(event) {
  const link = event.target.closest('a');
  if (!link || !navLinks.contains(link)) return;

  event.preventDefault();
  navLinks.querySelectorAll('a').forEach(navLink => {
    const isActive = navLink === link;
    navLink.classList.toggle('active', isActive);
    if (isActive) navLink.setAttribute('aria-current', 'page');
    else navLink.removeAttribute('aria-current');
  });
    if (link.dataset.view === 'main') showMainVideoPage();
});

document.querySelector('.hamburger')?.addEventListener('click', function() {
  if (navLinks) {
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
  }
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});
