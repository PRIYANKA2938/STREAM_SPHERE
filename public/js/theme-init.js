const savedPreference = localStorage.getItem('streamsphereThemePreference');
const savedTheme = localStorage.getItem('streamsphereTheme');
if (savedPreference === 'light' || savedPreference === 'dark' || savedPreference === 'auto') {
  applyThemePreference(savedPreference, false);
} else if (savedTheme === 'light' || savedTheme === 'dark') {
  applyTheme(savedTheme, false);
} else {
  applyLoginTheme();
}
updatePersonalizedExperience();
setInterval(updatePersonalizedExperience, 60000);
