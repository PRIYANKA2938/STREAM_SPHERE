function openVoiceClipDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('streamsphereVoiceComments', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('clips');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveVoiceClip(key, blob) {
  const database = await openVoiceClipDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('clips', 'readwrite');
    transaction.objectStore('clips').put(blob, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function getVoiceClip(key) {
  const database = await openVoiceClipDatabase();
  const blob = await new Promise((resolve, reject) => {
    const request = database.transaction('clips').objectStore('clips').get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return blob;
}

async function removeVoiceClip(key) {
  if (!key) return;
  const database = await openVoiceClipDatabase();
  await new Promise(resolve => {
    const transaction = database.transaction('clips', 'readwrite');
    transaction.objectStore('clips').delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
  database.close();
}

let voiceStream = null;
let voiceAudioContext = null;
let voiceProcessor = null;
let voiceChunks = [];
let voiceRecording = false;
let voiceRecordTimer = null;
let voicePreviewUrl = '';
const voiceCommentButton = document.getElementById('voiceCommentButton');
const voiceCommentStatus = document.getElementById('voiceCommentStatus');
const voiceCommentPreview = document.getElementById('voiceCommentPreview');
const voiceClipKeyInput = document.getElementById('voiceClipKey');
const commentTextInput = document.getElementById('commentText');
const commentGifUrlInput = document.getElementById('commentGifUrl');

function encodeVoiceRecording(chunks, sampleRate) {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  chunks.forEach(chunk => chunk.forEach(sample => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
    offset += 2;
  }));
  return new Blob([buffer], { type: 'audio/wav' });
}

async function stopVoiceRecording(discard = false) {
  if (!voiceRecording) return;
  voiceRecording = false;
  clearTimeout(voiceRecordTimer);
  voiceProcessor?.disconnect();
  voiceProcessor = null;
  voiceStream?.getTracks().forEach(track => track.stop());
  voiceStream = null;
  const sampleRate = voiceAudioContext?.sampleRate || 44100;
  if (voiceAudioContext && voiceAudioContext.state !== 'closed') await voiceAudioContext.close();
  voiceAudioContext = null;
  voiceCommentButton.textContent = '🎤 Voice';
  const clip = encodeVoiceRecording(voiceChunks, sampleRate);
  voiceChunks = [];
  if (discard) return;
  if (clip.size <= 44) {
    voiceCommentStatus.textContent = 'No audio was recorded. Hold the button longer and try again.';
    return;
  }
  const key = window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now());
  try {
    await saveVoiceClip(key, clip);
    voiceClipKeyInput.value = key;
    commentTextInput.required = false;
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    voicePreviewUrl = URL.createObjectURL(clip);
    voiceCommentPreview.src = voicePreviewUrl;
    voiceCommentPreview.load();
    voiceCommentPreview.hidden = false;
    voiceCommentStatus.textContent = 'Voice comment ready. Playback uses WAV audio for browser compatibility.';
  } catch (error) {
    voiceCommentStatus.textContent = 'Could not save this recording in browser storage.';
  }
}

voiceCommentButton.addEventListener('click', async () => {
  if (voiceRecording) {
    await stopVoiceRecording();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    voiceCommentStatus.textContent = 'Voice recording is not supported in this browser.';
    return;
  }
  try {
    voiceCommentStatus.textContent = 'Requesting microphone access...';
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceAudioContext = new AudioContext();
    if (voiceAudioContext.state === 'suspended') await voiceAudioContext.resume();
    const input = voiceAudioContext.createMediaStreamSource(voiceStream);
    voiceProcessor = voiceAudioContext.createScriptProcessor(4096, 1, 1);
    const silentOutput = voiceAudioContext.createGain();
    silentOutput.gain.value = 0;
    voiceProcessor.onaudioprocess = event => {
      if (voiceRecording) voiceChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    input.connect(voiceProcessor);
    voiceProcessor.connect(silentOutput);
    silentOutput.connect(voiceAudioContext.destination);
    voiceRecording = true;
    voiceCommentButton.textContent = 'Stop recording';
    voiceCommentStatus.textContent = 'Recording...';
    voiceRecordTimer = setTimeout(() => {
      stopVoiceRecording();
    }, 30000);
  } catch (error) {
    voiceStream?.getTracks().forEach(track => track.stop());
    voiceStream = null;
    if (voiceAudioContext && voiceAudioContext.state !== 'closed') await voiceAudioContext.close();
    voiceAudioContext = null;
    voiceCommentStatus.textContent = 'Microphone access was not granted.';
  }
});
