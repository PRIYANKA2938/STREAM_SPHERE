function getModerationMessage(comment) {
  const normalized = comment.toLowerCase().replace(/\s+/g, ' ').trim();

  // Line 3-6: Blocks abusive words / profanity
  const abusiveWords = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt'];
  if (abusiveWords.some(word => new RegExp('(^|[^a-z])' + word + '([^a-z]|$)', 'i').test(normalized))) {
    return 'Please remove abusive language before posting.';
  }

  // Line 8-10: Blocks website links
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|xyz|tk)\b)/i.test(normalized)) {
    return 'Links are not allowed in comments.';
  }

  // Line 11-13: Blocks promotional spam phrases
  if (/(free money|buy now|click here|subscribe now|follow me|promo code|make money)/i.test(normalized)) {
    return 'This comment looks like spam.';
  }

  // Line 14-18: Blocks repeated special characters (e.g. !!!!! or $$$$$)
  const visibleCharacters = normalized.replace(/\s/g, '');
  const specialCharacters = visibleCharacters.replace(/[\p{L}\p{N}]/gu, '');
  if (visibleCharacters.length >= 4 && specialCharacters.length / visibleCharacters.length >= 0.7) {
    return 'Comments made mostly of repeated special characters are not allowed.';
  }

  // Line 20-22: Blocks character flooding (e.g. "aaaaaa" or "hello hello hello hello")
  if (/(.)\1{5,}/u.test(visibleCharacters) || /(\b\w+\b)(?:\s+\1){3,}/iu.test(normalized)) {
    return 'Please avoid repeated characters or repeated words.';
  }

  return '';
}


function getModerationFlags(comment) {
  const message = getModerationMessage(comment);
  return message ? [message] : [];
}
