function getPersonalizedRegion() {
  const locale = navigator.language || 'en-US';
  const localeRegion = locale.includes('-') ? locale.split('-').pop().toUpperCase() : '';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  const regionNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([locale], { type: 'region' })
    : null;
  let region = localeRegion;
  try {
    region = regionNames && localeRegion ? regionNames.of(localeRegion) : region;
  } catch (error) {
    region = localeRegion;
  }
  return { locale, region: region || 'your region', timeZone };
}

function getTimeGreeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getIndiaTime() {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function applyLoginTheme() {
  const indiaMinutes = getIndiaTime();
  const lightTheme = indiaMinutes >= 600 && indiaMinutes < 720;
  applyTheme(lightTheme ? 'light' : 'dark', false);
}

function applyTheme(theme, save = true) {
  const selectedTheme = theme === 'light' || theme === 'dark' ? theme : 'dark';
  document.body.classList.toggle('light-theme', selectedTheme === 'light');
  if (save) localStorage.setItem('streamsphereTheme', selectedTheme);
}

function applyThemePreference(theme, save = true) {
  const preference = ['auto', 'light', 'dark'].includes(theme) ? theme : 'auto';
  if (save) localStorage.setItem('streamsphereThemePreference', preference);
  if (preference === 'auto') {
    localStorage.removeItem('streamsphereTheme');
    applyLoginTheme();
  } else {
    applyTheme(preference, true);
  }
}

function getDeviceTrustKey(locationOverride) {
  const regionInfo = getPersonalizedRegion();
  return [navigator.userAgent, navigator.platform, regionInfo.locale, regionInfo.timeZone, locationOverride || localStorage.getItem('streamsphereLocation') || ''].join('|');
}

function updatePersonalizedExperience(nameOverride) {
  const greeting = document.getElementById('personalizedGreeting');
  if (!greeting) return;
  const now = new Date();
  const regionInfo = getPersonalizedRegion();
  const savedUsername = typeof nameOverride === 'string' && nameOverride.trim()
    ? nameOverride.trim().slice(0, 40)
    : localStorage.getItem('streamsphereName') || 'Guest';
  const localTime = new Intl.DateTimeFormat(regionInfo.locale, { hour: 'numeric', minute: '2-digit' }).format(now);
  greeting.querySelector('strong').textContent = getTimeGreeting(now.getHours()) + ', ' + savedUsername;
  greeting.querySelector('span').textContent = regionInfo.region + ' · ' + localTime;
  greeting.title = 'Personalized for ' + regionInfo.timeZone;
}
