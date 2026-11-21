const commentLanguageSelector = document.getElementById('commentLanguageSelector');
const commentLanguageKey = 'streamsphereCommentLanguage';
const savedCommentLanguage = localStorage.getItem(commentLanguageKey);
if (savedCommentLanguage && [...commentLanguageSelector.options].some(option => option.value === savedCommentLanguage)) {
  commentLanguageSelector.value = savedCommentLanguage;
}
document.getElementById('language').value = commentLanguageSelector.value;

commentLanguageSelector.addEventListener('change', () => {
  localStorage.setItem(commentLanguageKey, commentLanguageSelector.value);
  document.getElementById('language').value = commentLanguageSelector.value;
});
