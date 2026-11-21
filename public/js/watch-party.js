const partyPage = document.getElementById('partyPage');
const partyContent = document.querySelector('.party-content');
const partyRoomLink = document.getElementById('partyRoomLink');
const partyStatus = document.getElementById('partyStatus');
const partyLocalVideo = document.getElementById('partyLocalVideo');
const partyRemoteVideo = document.getElementById('partyRemoteVideo');
const partyMessages = document.getElementById('partyMessages');
const partyChatForm = document.getElementById('partyChatForm');
const partyChatInput = document.getElementById('partyChatInput');
const partyParticipants = document.getElementById('partyParticipants');
const togglePartyMute = document.getElementById('togglePartyMute');
const togglePartyCamera = document.getElementById('togglePartyCamera');
const leaveCall = document.getElementById('leaveCall');
const togglePartyRecording = document.getElementById('togglePartyRecording');
let partyMediaStream = null;
let partyScreenStream = null;
let partyRecorder = null;
let partyRecordingChunks = [];
let partyRoomId = new URLSearchParams(window.location.search).get('party') || '';
let partyChannel = null;
let partyParticipantIds = new Set();
let applyingPartyUpdate = false;
const partyParticipantId = getViewerId();
const partyParticipantNames = new Map([[partyParticipantId, localStorage.getItem('streamsphereName') || 'Guest']]);

partyContent.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  partyContent.querySelectorAll('button.party-clicked').forEach(clickedButton => {
    clickedButton.classList.remove('party-clicked');
  });
  button.classList.add('party-clicked');
});

function partyInviteUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set('party', roomId);
  return url.toString();
}

function updatePartyStatus() {
  partyStatus.textContent = partyRoomId
    ? 'Room ' + partyRoomId + ' · ' + Math.max(1, partyParticipantIds.size) + ' participant' + (partyParticipantIds.size === 1 ? '' : 's')
    : 'No room is active.';
  partyRoomLink.value = partyRoomId ? partyInviteUrl(partyRoomId) : '';
  partyParticipants.innerHTML = '';
  partyParticipantIds.forEach(id => {
    const item = document.createElement('li');
    item.textContent = (partyParticipantNames.get(id) || 'Guest') + (id === partyParticipantId ? ' (you)' : '');
    partyParticipants.appendChild(item);
  });
}

function addPartyMessage(username, text) {
  const message = document.createElement('p');
  message.className = 'party-message';
  message.innerHTML = '<strong></strong> <span></span>';
  message.querySelector('strong').textContent = username + ':';
  message.querySelector('span').textContent = text;
  partyMessages.appendChild(message);
  partyMessages.scrollTop = partyMessages.scrollHeight;
}

function broadcastParty(message) {
  if (applyingPartyUpdate || !partyRoomId) return;
  const state = { ...message, senderId: partyParticipantId };
  if (partyChannel) partyChannel.postMessage(state);
  fetch(document.getElementById('commentForm').action, {
    method: 'POST',
    body: new URLSearchParams({ action: 'updatePartyState', roomId: partyRoomId, senderId: partyParticipantId, paused: state.paused, time: state.time }),
    mode: 'no-cors'
  }).catch(() => {});
}

function pollPartyState() {
  if (!partyRoomId) return;
  const callbackName = '__streamsphereParty_' + Date.now();
  window[callbackName] = response => {
    const state = response && response.state;
    if (state && state.senderId !== partyParticipantId && Date.now() - state.updatedAt < 10000) {
      applyingPartyUpdate = true;
      demoVideo.currentTime = Number(state.time) || 0;
      if (state.paused) demoVideo.pause(); else demoVideo.play().catch(() => {});
      setTimeout(() => { applyingPartyUpdate = false; }, 250);
    }
    delete window[callbackName];
    script.remove();
  };
  const script = document.createElement('script');
  script.src = document.getElementById('commentForm').action + '?action=getPartyState&roomId=' + encodeURIComponent(partyRoomId) + '&callback=' + callbackName;
  script.onerror = () => { delete window[callbackName]; script.remove(); };
  document.body.appendChild(script);
}

function connectToParty(roomId) {
  if (!roomId || !('BroadcastChannel' in window)) {
    partyStatus.textContent = roomId ? 'Watch Party needs a browser with BroadcastChannel support.' : 'No room is active.';
    return;
  }
  if (partyChannel) partyChannel.close();
  partyRoomId = roomId;
  partyParticipantIds = new Set([partyParticipantId]);
  partyParticipantNames.set(partyParticipantId, localStorage.getItem('streamsphereName') || 'Guest');
  partyChannel = new BroadcastChannel('streamsphere-watch-party-' + roomId);
  partyChannel.onmessage = event => {
    const message = event.data || {};
    if (message.senderId === partyParticipantId) return;
    if (message.type === 'presence') {
      partyParticipantIds.add(message.senderId);
      partyParticipantNames.set(message.senderId, message.username || 'Guest');
      partyChannel.postMessage({ type: 'presence', senderId: partyParticipantId, username: localStorage.getItem('streamsphereName') || 'Guest' });
    }
    if (message.type === 'leave') {
      partyParticipantIds.delete(message.senderId);
      partyParticipantNames.delete(message.senderId);
    }
    if (message.type === 'state-request') {
      partyChannel.postMessage({ type: 'state', paused: demoVideo.paused, time: demoVideo.currentTime, senderId: partyParticipantId });
    }
    if (message.type === 'chat') addPartyMessage(message.username, message.text);
    if (message.type === 'call-presence') partyStatus.textContent = 'Room ' + partyRoomId + ' · ' + Math.max(1, partyParticipantIds.size) + ' participant(s) · video call active';
    if (message.type === 'state') {
      applyingPartyUpdate = true;
      if (Number.isFinite(message.time)) demoVideo.currentTime = message.time;
      if (message.paused) demoVideo.pause(); else demoVideo.play().catch(() => {});
      setTimeout(() => { applyingPartyUpdate = false; }, 250);
    }
    updatePartyStatus();
  };
  partyChannel.postMessage({ type: 'presence', senderId: partyParticipantId, username: localStorage.getItem('streamsphereName') || 'Guest' });
  partyChannel.postMessage({ type: 'state-request', senderId: partyParticipantId });
  updatePartyStatus();
  pollPartyState();
}

function openPartyDialog() {
  showDestinationPage(partyPage);
  updatePartyStatus();
}

document.getElementById('watchPartyNavLink').addEventListener('click', event => {
  event.preventDefault();
  openPartyDialog();
});
document.getElementById('createPartyRoom').addEventListener('click', () => {
  connectToParty(Math.random().toString(36).slice(2, 8).toUpperCase());
  partyStatus.textContent = 'Room created. Copy the invite link for friends.';
});
document.getElementById('joinPartyRoom').addEventListener('click', () => {
  const roomId = prompt('Enter the room code from your invite link:', partyRoomId || '');
  if (roomId) connectToParty(roomId.trim().toUpperCase());
});
document.getElementById('copyPartyLink').addEventListener('click', async () => {
  if (!partyRoomId) return;
  try {
    await navigator.clipboard.writeText(partyInviteUrl(partyRoomId));
    partyStatus.textContent = 'Invite link copied.';
  } catch (error) {
    partyRoomLink.select();
    document.execCommand('copy');
    partyStatus.textContent = 'Invite link copied.';
  }
});
document.getElementById('closeParty').addEventListener('click', () => {
  showMainVideoPage();
});
document.getElementById('joinCall').addEventListener('click', async () => {
  if (!partyRoomId) {
    partyStatus.textContent = 'Create or join a room before joining the call.';
    return;
  }
  try {
    partyMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    partyLocalVideo.srcObject = partyMediaStream;
    document.getElementById('joinCall').textContent = 'Camera and mic connected';
    if (partyChannel) partyChannel.postMessage({ type: 'call-presence', senderId: partyParticipantId });
  } catch (error) {
    partyStatus.textContent = 'Camera and microphone permission is required to join the call.';
  }
});
togglePartyMute.addEventListener('click', () => {
  if (!partyMediaStream) return;
  const audioTrack = partyMediaStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  togglePartyMute.textContent = audioTrack.enabled ? 'Mute mic' : 'Unmute mic';
});
togglePartyCamera.addEventListener('click', () => {
  if (!partyMediaStream) return;
  const videoTrack = partyMediaStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  togglePartyCamera.textContent = videoTrack.enabled ? 'Turn camera off' : 'Turn camera on';
});
leaveCall.addEventListener('click', () => {
  if (partyRecorder && partyRecorder.state === 'recording') partyRecorder.stop();
  [partyMediaStream, partyScreenStream].forEach(stream => stream?.getTracks().forEach(track => track.stop()));
  partyMediaStream = null;
  partyScreenStream = null;
  partyLocalVideo.srcObject = null;
  togglePartyMute.textContent = 'Mute mic';
  togglePartyCamera.textContent = 'Turn camera off';
  document.getElementById('joinCall').textContent = 'Join video call';
  if (partyChannel) partyChannel.postMessage({ type: 'leave', senderId: partyParticipantId });
  partyStatus.textContent = 'You left the call.';
});
window.addEventListener('beforeunload', () => {
  if (partyChannel) partyChannel.postMessage({ type: 'leave', senderId: partyParticipantId });
});
togglePartyRecording.addEventListener('click', () => {
  if (!partyMediaStream && !partyScreenStream) {
    partyStatus.textContent = 'Join the call or share your screen before recording.';
    return;
  }
  if (partyRecorder && partyRecorder.state === 'recording') {
    partyRecorder.stop();
    return;
  }
  const recordingStream = partyScreenStream || partyMediaStream;
  partyRecordingChunks = [];
  const recordingMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
  try {
    partyRecorder = recordingMimeType ? new MediaRecorder(recordingStream, { mimeType: recordingMimeType }) : new MediaRecorder(recordingStream);
  } catch (error) {
    partyStatus.textContent = 'Recording is not supported by this browser.';
    return;
  }
  partyRecorder.ondataavailable = event => { if (event.data.size) partyRecordingChunks.push(event.data); };
  partyRecorder.onstop = () => {
    const downloadUrl = URL.createObjectURL(new Blob(partyRecordingChunks, { type: 'video/webm' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'streamsphere-watch-party-' + (partyRoomId || 'session') + '.webm';
    link.textContent = 'Download recording';
    link.className = 'party-secondary';
    link.style.display = 'inline-block';
    document.querySelector('.party-actions').appendChild(link);
    togglePartyRecording.textContent = 'Record locally';
    togglePartyRecording.classList.remove('party-recording');
    partyStatus.textContent = 'Recording is stored locally for the host.';
  };
  partyRecorder.start();
  togglePartyRecording.textContent = 'Stop recording';
  togglePartyRecording.classList.add('party-recording');
  partyStatus.textContent = 'Recording locally on the host.';
});
document.getElementById('shareScreen').addEventListener('click', async () => {
  if (!partyRoomId) {
    partyStatus.textContent = 'Create or join a room before sharing your screen.';
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    partyStatus.textContent = 'Screen sharing is not supported by this browser.';
    return;
  }
  try {
    partyScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    partyLocalVideo.srcObject = partyScreenStream;
    partyScreenStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (partyMediaStream) partyLocalVideo.srcObject = partyMediaStream;
    });
    partyStatus.textContent = 'Your screen is being shared with the party.';
  } catch (error) {
    partyStatus.textContent = 'Screen sharing was cancelled.';
  }
});
partyChatForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = partyChatInput.value.trim();
  if (!text || !partyChannel) return;
  const username = localStorage.getItem('streamsphereName') || 'Guest';
  partyChannel.postMessage({ type: 'chat', senderId: partyParticipantId, username, text });
  addPartyMessage(username, text);
  partyChatInput.value = '';
});

if (partyRoomId) {
  connectToParty(partyRoomId);
  openPartyDialog();
}
