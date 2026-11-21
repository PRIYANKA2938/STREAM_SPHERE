const TRANSLATION_LANGUAGES = [
  ['en', 'English'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['te', 'Telugu'], ['ml', 'Malayalam'],
  ['kn', 'Kannada'], ['bn', 'Bengali'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['pa', 'Punjabi'],
  ['ur', 'Urdu'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'],
  ['pt', 'Portuguese'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['ar', 'Arabic'], ['he', 'Hebrew'],
  ['fa', 'Persian'], ['tr', 'Turkish'], ['nl', 'Dutch'], ['pl', 'Polish'], ['sv', 'Swedish'],
  ['da', 'Danish'], ['no', 'Norwegian'], ['fi', 'Finnish'], ['el', 'Greek'], ['th', 'Thai'],
  ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['ms', 'Malay'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['zh-CN', 'Chinese (Simplified)'], ['zh-TW', 'Chinese (Traditional)'], ['sw', 'Swahili'],
  ['la', 'Latin'], ['auto', 'Detect language']
];

function createLanguageOptions() {
  return TRANSLATION_LANGUAGES
    .filter(language => language[0] !== 'auto')
    .map(language => '<option value="' + language[0] + '">' + language[1] + '</option>')
    .join('');
}

function getPreferredTranslationLanguage() {
  const savedLanguage = localStorage.getItem('streamspherePreferredTranslationLanguage');
  if (savedLanguage && TRANSLATION_LANGUAGES.some(language => language[0] === savedLanguage)) return savedLanguage;
  const browserLanguage = (navigator.language || 'en').toLowerCase();
  return TRANSLATION_LANGUAGES.find(language => language[0].toLowerCase() === browserLanguage)?.[0]
    || TRANSLATION_LANGUAGES.find(language => language[0].toLowerCase() === browserLanguage.split('-')[0])?.[0]
    || 'en';
}

async function translateComment(card, targetLanguage, button) {
  const commentText = card.querySelector('.comment-text');
  const originalText = card.dataset.originalComment || commentText.textContent.trim();
  const originalLanguage = card.dataset.originalLanguage || commentText.lang || card.dataset.language || 'en';
  const translationBox = card.querySelector('[data-translation-box]') || document.createElement('div');
  const translationText = translationBox.querySelector('[data-translation-text]') || document.createElement('p');
  const translationLabel = translationBox.querySelector('[data-translation-label]') || document.createElement('span');
  const originalToggle = translationBox.querySelector('[data-original-toggle]') || document.createElement('button');

  card.dataset.originalComment = originalText;
  card.dataset.originalLanguage = originalLanguage;
  localStorage.setItem('streamspherePreferredTranslationLanguage', targetLanguage);
  button.disabled = true;
  button.textContent = 'Translating...';
  try {
    const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(targetLanguage) + '&dt=t&q=' + encodeURIComponent(originalText));
    if (!response.ok) throw new Error('Translation request failed');
    const data = await response.json();
    const translatedText = (data[0] || []).map(part => part[0]).filter(Boolean).join('');
    if (!translatedText) throw new Error('No translation returned');

    translationBox.className = 'translation-box';
    translationLabel.dataset.translationLabel = 'true';
    translationLabel.textContent = 'Translated to ' + (TRANSLATION_LANGUAGES.find(language => language[0] === targetLanguage) || ['', targetLanguage])[1];
    originalToggle.type = 'button';
    originalToggle.dataset.originalToggle = 'true';
    originalToggle.textContent = 'Show Translation';
    translationText.dataset.translationText = 'true';
    translationText.className = 'translation-quote';
    translationText.textContent = '"' + translatedText + '"';
    translationBox.replaceChildren(document.createElement('div'), translationText);
    const row = translationBox.firstElementChild;
    row.className = 'translation-row';
    row.append(translationLabel, originalToggle);
    originalToggle.onclick = () => {
      const showingOriginal = commentText.textContent === originalText;
      commentText.textContent = showingOriginal ? translatedText : originalText;
      commentText.lang = showingOriginal ? targetLanguage : originalLanguage;
      originalToggle.textContent = showingOriginal ? 'Show Original' : 'Show Translation';
    };
    const historyKey = 'streamsphereTranslationHistory:' + card.dataset.commentId;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.push({ language: targetLanguage, text: translatedText, translatedAt: new Date().toISOString() });
    const savedHistory = history.slice(-10);
    localStorage.setItem(historyKey, JSON.stringify(savedHistory));
    const historyControls = document.createElement('label');
    historyControls.className = 'translation-history';
    historyControls.append('Translation history');
    const historySelect = document.createElement('select');
    historySelect.setAttribute('aria-label', 'Switch between original and previous translations');
    historySelect.innerHTML = '<option value="original">Original</option>' + savedHistory.map((item, index) => {
      const languageName = (TRANSLATION_LANGUAGES.find(language => language[0] === item.language) || ['', item.language])[1];
      return '<option value="' + index + '">' + languageName + ' · ' + formatRelativeTime(item.translatedAt) + '</option>';
    }).join('');
    historySelect.value = String(savedHistory.length - 1);
    historySelect.addEventListener('change', () => {
      const selected = historySelect.value === 'original' ? null : savedHistory[Number(historySelect.value)];
      commentText.textContent = selected ? selected.text : originalText;
      commentText.lang = selected ? selected.language : originalLanguage;
      originalToggle.textContent = selected ? 'Show Original' : 'Show Translation';
    });
    historyControls.appendChild(historySelect);
    translationBox.appendChild(historyControls);
    if (!translationBox.parentElement) card.querySelector('.comment-main').appendChild(translationBox);
  } catch (error) {
    translationBox.className = 'translation-box';
    translationBox.textContent = 'Translation unavailable. Please check your connection and try again.';
    if (!translationBox.parentElement) card.querySelector('.comment-main').appendChild(translationBox);
    console.error('Translation error:', error);
  } finally {
    button.disabled = false;
    button.textContent = 'Translate';
  }
}

function initializeTranslationControls(card) {
  const commentText = card.querySelector('.comment-text');
  const commentMain = card.querySelector('.comment-main');
  if (!commentText || !commentMain || card.querySelector('.translate-controls')) return;
  card.dataset.originalComment = commentText.textContent.trim();
  const controls = document.createElement('div');
  controls.className = 'translate-controls';
  controls.innerHTML = '<select aria-label="Translate comment to a language">' + createLanguageOptions() + '</select><button type="button">Translate</button>';
  const languageSelect = controls.querySelector('select');
  languageSelect.value = getPreferredTranslationLanguage();
  languageSelect.addEventListener('change', () => {
    localStorage.setItem('streamspherePreferredTranslationLanguage', languageSelect.value);
  });
  controls.querySelector('button').addEventListener('click', () => {
    translateComment(card, languageSelect.value, controls.querySelector('button'));
  });
  commentMain.insertBefore(controls, commentMain.querySelector('.interaction-bar'));
}
