require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve your untouched frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------
// 1. COMMENTS API (Multilingual, moderation, reactions and reports)
// ------------------------------------------------------------------
function moderateComment(value) {
  const comment = String(value || '').trim();
  const normalized = comment.toLowerCase().replace(/\s+/g, ' ');
  const abusiveWords = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt'];
  if (abusiveWords.some(word => new RegExp('(^|[^a-z])' + word + '([^a-z]|$)', 'i').test(normalized))) {
    return 'Please remove abusive language before posting.';
  }
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|xyz|tk)\b)/i.test(normalized)) {
    return 'Links are not allowed in comments.';
  }
  if (/(free money|buy now|click here|subscribe now|follow me|promo code|make money)/i.test(normalized)) {
    return 'This comment looks like spam.';
  }
  const visibleCharacters = normalized.replace(/\s/g, '');
  const specialCharacters = visibleCharacters.replace(/[\p{L}\p{N}]/gu, '');
  if (visibleCharacters.length >= 4 && specialCharacters.length / visibleCharacters.length >= 0.7) {
    return 'Comments made mostly of repeated special characters are not allowed.';
  }
  if (/(.)\1{5,}/u.test(visibleCharacters) || /(\b\w+\b)(?:\s+\1){3,}/iu.test(normalized)) {
    return 'Please avoid repeated characters or repeated words.';
  }
  if (comment.length > 5000) return 'Comments must be 5,000 characters or fewer.';
  return '';
}

function publicRegion(location) {
  const parts = String(location || '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(', ').slice(0, 100) : '';
}

function jsonp(req, res, payload) {
  const callback = String(req.query.callback || '');
  if (!callback) return res.json(payload);
  if (!/^[A-Za-z_$][\w$]*$/.test(callback)) {
    return res.status(400).json({ status: 'error', message: 'Invalid callback.' });
  }
  res.type('application/javascript').send(callback + '(' + JSON.stringify(payload).replace(/</g, '\\u003c') + ');');
}

function listComments(videoId, viewerId) {
  const rows = db.prepare(`
    SELECT c.id, c.videoId, c.username, c.text, c.timestamp, c.isReported,
      c.isPinned, c.replyCount, c.language, c.showLocation, c.city, c.publicRegion, c.parentCommentId,
      COALESCE(SUM(CASE WHEN r.reaction = 'like' THEN 1 ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN r.reaction = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes,
      (SELECT reaction FROM reactions WHERE commentId = c.id AND reactorId = ?) AS viewerReaction,
      (SELECT COUNT(*) FROM commentReports WHERE commentId = c.id) AS reportCount,
      EXISTS(SELECT 1 FROM commentReports WHERE commentId = c.id AND reporterId = ?) AS hasReported
    FROM comments c
    LEFT JOIN reactions r ON c.id = r.commentId
    WHERE c.videoId = ? AND c.isRemoved = 0
    GROUP BY c.id
    ORDER BY c.isPinned DESC, c.timestamp DESC
  `).all(viewerId, viewerId, videoId);
  return rows.map(comment => {
    const region = comment.showLocation ? comment.publicRegion || publicRegion(comment.city) : '';
    return {
      commentId: comment.id,
      videoId: comment.videoId,
      parentCommentId: comment.parentCommentId,
      username: comment.username,
      comment: comment.text,
      timestamp: comment.timestamp,
      publicRegion: region,
      showLocation: Boolean(region),
      language: comment.language || 'en',
      likes: comment.likes,
      dislikes: comment.dislikes,
      viewerReaction: comment.viewerReaction || '',
      reportCount: comment.reportCount,
      hasReported: Boolean(comment.hasReported),
      isReported: Boolean(comment.isReported),
      isPinned: Boolean(comment.isPinned),
      replyCount: comment.replyCount
    };
  });
}

function createComment(req, res) {
  const body = req.body || {};
  const text = String(body.text || body.comment || '').trim();
  const username = String(body.username || 'Guest User').trim().slice(0, 80) || 'Guest User';
  const authorId = String(body.viewerId || '').trim().slice(0, 120) || 'guest:' + username.toLowerCase();
  const moderationMessage = moderateComment(text);
  if (!text) return res.status(400).json({ status: 'error', message: 'Comment cannot be empty.' });
  if (moderationMessage) return res.status(400).json({ status: 'blocked', message: moderationMessage });

  const now = new Date();
  const recent = db.prepare('SELECT timestamp, text FROM comments WHERE authorId = ? ORDER BY timestamp DESC LIMIT 1').get(authorId);
  if (recent) {
    const elapsed = now.getTime() - new Date(recent.timestamp).getTime();
    if (elapsed < 10000) {
      return res.status(429).json({ status: 'error', message: 'Slow mode is on. Wait before posting another comment.' });
    }
    if (recent.text.trim().toLowerCase() === text.toLowerCase()) {
      return res.status(400).json({ status: 'blocked', message: 'Repeated comments are not allowed.' });
    }
  }

  const commentId = String(body.commentId || body.id || 'c_' + Date.now()).slice(0, 120);
  const showLocation = String(body.showLocation) === 'true' || body.showLocation === true;
  const region = showLocation ? publicRegion(body.location || body.city) : '';
  const timestamp = now.toISOString();
  try {
    db.prepare(`
      INSERT INTO comments (id, videoId, username, text, city, timestamp, language, showLocation, authorId, parentCommentId, publicRegion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      commentId,
      String(body.videoId || 'main').slice(0, 120),
      username,
      text,
      '',
      timestamp,
      String(body.language || 'en').slice(0, 20),
      region ? 1 : 0,
      authorId,
      String(body.parentCommentId || '').slice(0, 120) || null,
      region
    );
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ status: 'error', message: 'This comment was already submitted.' });
    }
    throw error;
  }
  res.status(201).json({ status: 'success', commentId, timestamp, publicRegion: region, showLocation: Boolean(region) });
}

app.get('/api/comments', (req, res) => {
  res.json({
    status: 'success',
    comments: listComments(String(req.query.videoId || 'main'), String(req.query.viewerId || ''))
  });
});

app.post('/api/comments', createComment);

app.get('/api', (req, res) => {
  if (req.query.action === 'checkComment') {
    const message = moderateComment(req.query.comment);
    return jsonp(req, res, { status: 'success', allowed: !message, message });
  }
  if (req.query.action) {
    return jsonp(req, res, { status: 'error', message: 'Unsupported comment action.' });
  }
  const videoId = String(req.query.videoId || 'celestial-anomaly-ep4');
  return jsonp(req, res, {
    status: 'success',
    comments: listComments(videoId, String(req.query.viewerId || req.query.reactorId || ''))
  });
});

app.post('/api/comments/:commentId/reaction', (req, res) => {
  const { commentId } = req.params;
  const { reactorId, reaction } = req.body || {};
  if (!String(reactorId || '').trim()) return res.status(400).json({ status: 'error', message: 'Viewer ID is required.' });
  if (!['', 'like', 'dislike'].includes(reaction)) return res.status(400).json({ status: 'error', message: 'Reaction must be like, dislike, or empty.' });
  ensureCommentExists(commentId, req.body);
  if (reaction === '') {
    db.prepare('DELETE FROM reactions WHERE commentId = ? AND reactorId = ?').run(commentId, reactorId);
  } else {
    db.prepare(`
      INSERT INTO reactions (commentId, reactorId, reaction, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(commentId, reactorId) DO UPDATE SET reaction = excluded.reaction, updatedAt = excluded.updatedAt
    `).run(commentId, reactorId, reaction, new Date().toISOString());
  }
  res.json({ status: 'success' });
});

app.post('/api/comments/:commentId/report', (req, res) => {
  const { commentId } = req.params;
  const { reporterId, reason } = req.body || {};
  if (!String(reporterId || '').trim()) return res.status(400).json({ status: 'error', message: 'Viewer ID is required.' });
  ensureCommentExists(commentId, req.body);
  if (!db.prepare('SELECT 1 FROM comments WHERE id = ?').get(commentId)) {
    return res.status(404).json({ status: 'error', message: 'Comment not found.' });
  }
  db.prepare(`
    INSERT INTO commentReports (commentId, reporterId, reason, timestamp)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(commentId, reporterId) DO UPDATE SET reason = excluded.reason, timestamp = excluded.timestamp
  `).run(commentId, reporterId, String(reason || 'Inappropriate content').slice(0, 500), new Date().toISOString());
  db.prepare('UPDATE comments SET isReported = 1 WHERE id = ?').run(commentId);
  res.json({ status: 'success', isReported: true });
});

app.get('/api/comments/review', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Please sign in again.' });
  const moderators = String(process.env.COMMENT_MODERATOR_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  const canModerate = moderators.includes(user.email.toLowerCase());
  if (!canModerate) return res.json({ status: 'success', canModerate: false, items: [] });

  const items = db.prepare(`
    SELECT c.id AS commentId, c.username, c.text AS comment, c.timestamp,
      COUNT(r.reporterId) AS reportCount,
      (SELECT reason FROM commentReports WHERE commentId = c.id ORDER BY timestamp DESC LIMIT 1) AS reason
    FROM comments c
    LEFT JOIN commentReports r ON r.commentId = c.id
    WHERE c.isReported = 1 AND c.isRemoved = 0
    GROUP BY c.id
    ORDER BY c.timestamp ASC
  `).all();
  res.json({ status: 'success', canModerate: true, items });
});

app.post('/api/comments/:commentId/moderation', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Please sign in again.' });
  const moderators = String(process.env.COMMENT_MODERATOR_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  if (!moderators.includes(user.email.toLowerCase())) {
    return res.status(403).json({ status: 'error', message: 'You do not have permission to review comments.' });
  }
  const { decision } = req.body || {};
  if (!['keep', 'remove'].includes(decision)) {
    return res.status(400).json({ status: 'error', message: 'Choose whether to keep or remove the comment.' });
  }
  const comment = db.prepare('SELECT 1 FROM comments WHERE id = ? AND isRemoved = 0').get(req.params.commentId);
  if (!comment) return res.status(404).json({ status: 'error', message: 'Comment not found.' });

  db.prepare('UPDATE comments SET isReported = 0, isRemoved = ? WHERE id = ?')
    .run(decision === 'remove' ? 1 : 0, req.params.commentId);
  res.json({ status: 'success', decision });
});

function ensureCommentExists(commentId, body = {}) {
  if (db.prepare('SELECT 1 FROM comments WHERE id = ?').get(commentId)) return;
  const text = String(body.text || body.comment || '').trim().slice(0, 5000);
  if (!text) return;
  db.prepare(`
    INSERT INTO comments (id, videoId, username, text, timestamp, language, authorId)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(commentId).slice(0, 120),
    String(body.videoId || 'celestial-anomaly-ep4').slice(0, 120),
    String(body.username || 'Guest User').trim().slice(0, 80) || 'Guest User',
    text,
    String(body.timestamp || new Date().toISOString()),
    String(body.language || 'en').slice(0, 20),
    ''
  );
}

// ------------------------------------------------------------------
// 2. REACTIONS API (Like & Dislike without disappearing)
// ------------------------------------------------------------------
app.post('/api/reaction', (req, res) => {
  const { commentId, reactorId, reaction } = req.body;
  if (!commentId || !reactorId || !['', 'like', 'dislike'].includes(reaction)) {
    return res.status(400).json({ status: 'error', message: 'Missing parameters' });
  }

  if (reaction === '') {
    db.prepare('DELETE FROM reactions WHERE commentId = ? AND reactorId = ?').run(commentId, reactorId);
    return res.json({ status: 'success' });
  }

  const upsert = db.prepare(`
    INSERT INTO reactions (commentId, reactorId, reaction, updatedAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(commentId, reactorId) DO UPDATE SET
      reaction = excluded.reaction,
      updatedAt = excluded.updatedAt
  `);

  upsert.run(commentId, reactorId, reaction, new Date().toISOString());
  res.json({ status: 'success' });
});

function getVideoReactionState(videoId, reactorId) {
  const counts = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes
    FROM videoReactions
    WHERE videoId = ?
  `).get(videoId);
  const viewer = db.prepare(`
    SELECT reaction FROM videoReactions
    WHERE videoId = ? AND reactorId = ?
  `).get(videoId, reactorId);

  return {
    status: 'success',
    likes: counts.likes,
    dislikes: counts.dislikes,
    viewerReaction: viewer ? viewer.reaction : ''
  };
}

app.get('/api/video-reactions', (req, res) => {
  const { videoId, reactorId } = req.query;
  if (typeof videoId !== 'string' || !videoId.trim() || typeof reactorId !== 'string' || !reactorId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Video and viewer IDs are required.' });
  }

  res.json(getVideoReactionState(videoId, reactorId));
});

app.post('/api/video-reactions', (req, res) => {
  const { videoId, reactorId, reaction } = req.body;
  if (typeof videoId !== 'string' || !videoId.trim() || typeof reactorId !== 'string' || !reactorId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Video and viewer IDs are required.' });
  }
  if (!['', 'like', 'dislike'].includes(reaction)) {
    return res.status(400).json({ status: 'error', message: 'Reaction must be like, dislike, or empty.' });
  }

  if (reaction === '') {
    db.prepare('DELETE FROM videoReactions WHERE videoId = ? AND reactorId = ?').run(videoId, reactorId);
  } else {
    db.prepare(`
      INSERT INTO videoReactions (videoId, reactorId, reaction, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(videoId, reactorId) DO UPDATE SET
        reaction = excluded.reaction,
        updatedAt = excluded.updatedAt
    `).run(videoId, reactorId, reaction, new Date().toISOString());
  }

  res.json(getVideoReactionState(videoId, reactorId));
});

// ------------------------------------------------------------------
// 3. CONTROLLED VIDEO DOWNLOADS (Task 2 Quotas)
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// TASK 2: CONTROLLED VIDEO DOWNLOADS & QUOTAS
// ------------------------------------------------------------------
const PLAN_LIMITS = { free: 1, bronze: 3, silver: 10, gold: 50 };
// Force real video download as a file attachment to user's computer
app.get('/api/download', async (req, res) => {
  const videoUrl = req.query.url || 'https://images-assets.nasa.gov/video/Apollo_11_Introduction_720p/Apollo_11_Introduction_720p~medium.mp4';
  const filename = req.query.filename || 'celestial-anomaly-episode-4.mp4';

  try {
    const upstream = await fetch(videoUrl);
    if (!upstream.ok) {
      return res.redirect(videoUrl);
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'));
    }

    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('Download stream error:', error);
    res.redirect(videoUrl);
  }
});

app.post('/api', (req, res, next) => {
  const action = req.body.action;

    // 1. Authorize Download & Enforce Restrictions
  if (action === 'authorizeDownload') {
    const viewerId = req.body.viewerId || 'anonymous';
    const userEmail = (req.body.email || viewerId).trim().toLowerCase();
    const plan = (req.body.plan || 'free').toLowerCase();
    const limit = PLAN_LIMITS[plan] || 1;
    const videoId = req.body.videoId || 'celestial-anomaly-ep4';
    const videoTitle = req.body.videoTitle || 'The Celestial Anomaly - Episode 4';

    // Check if this video has already been downloaded on this account
    const alreadyDownloaded = db.prepare(`
      SELECT id FROM downloads 
      WHERE LOWER(userEmail) = ? AND (videoId = ? OR LOWER(videoTitle) = LOWER(?))
    `).get(userEmail, videoId, videoTitle);

    if (alreadyDownloaded) {
      return res.json({
        status: 'denied',
        plan: plan,
        message: 'You have already downloaded this video on this account!'
      });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Count downloads made today
    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM downloads 
      WHERE LOWER(userEmail) = ? AND downloadDate LIKE ?
    `).get(userEmail, today + '%');

    if (countRow && countRow.count >= limit) {
      return res.json({
        status: 'denied',
        plan: plan,
        message: `Your ${plan.toUpperCase()} plan allows ${limit} download${limit === 1 ? '' : 's'} per day. Upgrade your plan for more!`
      });
    }

    // Save download audit entry in database
    db.prepare(`
      INSERT INTO downloads (id, userEmail, videoId, videoTitle, downloadDate, plan, videoUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'dl_' + Date.now(),
      userEmail,
      videoId,
      videoTitle,
      new Date().toISOString(),
      plan,
      req.body.videoUrl || null
    );

    return res.json({
      status: 'authorized',
      plan: plan,
      remaining: limit - (countRow ? countRow.count : 0) - 1
    });
  }

  // 2. Fetch User Download History for Profile
  if (action === 'getDownloadHistory') {
    const userEmail = req.body.email || req.body.viewerId || 'anonymous';
    const rows = db.prepare(`
      SELECT videoTitle as title, videoId, videoUrl, downloadDate as date, plan
      FROM downloads 
      WHERE userEmail = ? 
      ORDER BY downloadDate DESC
    `).all(userEmail);
    return res.json({ status: 'success', history: rows });
  }
const partyRooms = {};
// In app.post('/api', ...) or app.get:
if (action === 'updatePartyState') {
  partyRooms[req.body.roomId] = { ...req.body, updatedAt: Date.now() };
  return res.json({ status: 'success' });
}
if (req.query.action === 'getPartyState') {
  return res.json({ state: partyRooms[req.query.roomId] || null });
}

  // 3. Get User Plan Status
  if (action === 'getDownloadStatus') {
    const userEmail = req.body.email || req.body.viewerId || 'anonymous';
    const user = db.prepare('SELECT plan FROM users WHERE email = ?').get(userEmail);
    return res.json({ status: 'success', plan: user ? user.plan : 'free' });
  }

  next();
});


// ------------------------------------------------------------------
// 4. AUTHENTICATION & PLANS
// ------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPassword(password, storedPassword) {
  const parts = String(storedPassword || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(password, parts[1], expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

db.prepare('SELECT id, password FROM users').all().forEach(user => {
  if (!String(user.password).startsWith('scrypt$')) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(String(user.password)), user.id);
  }
});

function createSmtpTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function hashDeviceKey(deviceKey) {
  return crypto.createHash('sha256').update(deviceKey).digest('hex');
}

function createSession(user, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO userSessions (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
    .run(crypto.createHash('sha256').update(token).digest('hex'), user.id, now.toISOString(), expiresAt);
  res.json({
    status: 'success',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || 'free',
      theme: ['auto', 'light', 'dark'].includes(user.theme) ? user.theme : 'auto',
      mobile: user.mobile || '',
      location: user.location || ''
    }
  });
}

function maskedEmail(email) {
  const [name, domain] = email.split('@');
  return (name.length > 2 ? name.slice(0, 2) : name[0]) + '***@' + domain;
}

function loginUser(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const deviceKey = String(req.body.deviceKey || '').trim();
  const region = String(req.body.region || 'unknown').trim().replace(/\s+/g, ' ').slice(0, 120).toLowerCase() || 'unknown';
  if (!email || !password || deviceKey.length < 16) {
    return res.status(400).json({ status: 'error', message: 'Email, password, and device details are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
  }

  const deviceHash = hashDeviceKey(deviceKey);
  const trusted = db.prepare(`
    SELECT 1 FROM trustedLoginDevices
    WHERE userId = ? AND deviceHash = ? AND region = ?
  `).get(user.id, deviceHash, region);
  if (trusted) {
    db.prepare(`
      UPDATE trustedLoginDevices SET lastSeenAt = ?
      WHERE userId = ? AND deviceHash = ? AND region = ?
    `).run(new Date().toISOString(), user.id, deviceHash, region);
    return createSession(user, res);
  }

  const transport = createSmtpTransport();
  if (!transport) {
    return res.status(503).json({
      status: 'error',
      message: 'Email verification is not configured. Please contact support.'
    });
  }
  const now = new Date();
  const recentChallenge = db.prepare(`
    SELECT createdAt FROM authChallenges
    WHERE userId = ? AND usedAt IS NULL
    ORDER BY createdAt DESC LIMIT 1
  `).get(user.id);
  if (recentChallenge && now.getTime() - new Date(recentChallenge.createdAt).getTime() < 60000) {
    return res.status(429).json({ status: 'error', message: 'A verification code was recently sent. Please wait before requesting another.' });
  }

  const challengeId = crypto.randomBytes(24).toString('hex');
  const code = String(crypto.randomInt(100000, 1000000));
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const codeHash = crypto.createHash('sha256').update(challengeId + ':' + code).digest('hex');
  db.prepare(`
    INSERT INTO authChallenges (id, userId, codeHash, deviceHash, region, attempts, createdAt, expiresAt, lastSentAt)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(challengeId, user.id, codeHash, deviceHash, region, createdAt, expiresAt, createdAt);

  transport.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Your StreamSphere sign-in verification code',
    text: 'Your verification code is ' + code + '. It expires in 5 minutes. If you did not try to sign in, you can ignore this email.'
  }).then(() => {
    res.status(202).json({
      status: 'otp_required',
      challengeId,
      destination: maskedEmail(user.email),
      expiresInSeconds: 300
    });
  }).catch(error => {
    db.prepare('DELETE FROM authChallenges WHERE id = ?').run(challengeId);
    console.error('Unable to deliver sign-in verification email:', error.message);
    if (!res.headersSent) res.status(502).json({ status: 'error', message: 'Unable to send a verification email. Please try again later.' });
  });
}

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Enter a name and a valid email address.' });
  }
  if (!/^(?=.*\d.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters, include 2 numbers, and include a symbol.' });
  }

  // 1. Explicit check: Ensure email has not been signed up before
  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (existingUser) {
    return res.status(409).json({ status: 'error', message: 'An account with this email already exists. Please log in.' });
  }

  // 2. Insert only once
  try {
    db.prepare(`
      INSERT INTO users (id, name, email, password, plan, theme, createdAt)
      VALUES (?, ?, ?, ?, 'free', 'auto', ?)
    `).run(crypto.randomUUID(), name, email, hashPassword(password), new Date().toISOString());
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ status: 'error', message: 'An account with this email already exists. Please log in.' });
    }
    throw error;
  }

  res.status(201).json({ status: 'success', message: 'Account created. Log in to continue.' });
});

app.post(['/api/login', '/api/auth/login'], loginUser);

app.post('/api/auth/verify-otp', (req, res) => {
  const challengeId = String(req.body.challengeId || '');
  const code = String(req.body.code || '');
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ status: 'error', message: 'Enter the 6-digit verification code.' });
  }
  const challenge = db.prepare(`
    SELECT * FROM authChallenges WHERE id = ? AND usedAt IS NULL
  `).get(challengeId);
  if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ status: 'error', message: 'This verification code has expired. Sign in again to request a new one.' });
  }
  if (challenge.attempts >= 5) {
    return res.status(429).json({ status: 'error', message: 'Too many incorrect codes. Sign in again to request a new one.' });
  }

  const submittedHash = crypto.createHash('sha256').update(challengeId + ':' + code).digest('hex');
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(submittedHash, 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    db.prepare('UPDATE authChallenges SET attempts = attempts + 1 WHERE id = ?').run(challengeId);
    return res.status(400).json({ status: 'error', message: 'That verification code is incorrect.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challenge.userId);
  if (!user) return res.status(400).json({ status: 'error', message: 'This account is no longer available.' });
  const now = new Date().toISOString();
  db.prepare('UPDATE authChallenges SET usedAt = ? WHERE id = ?').run(now, challengeId);
  db.prepare(`
    INSERT INTO trustedLoginDevices (userId, deviceHash, region, lastSeenAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, deviceHash, region) DO UPDATE SET lastSeenAt = excluded.lastSeenAt
  `).run(user.id, challenge.deviceHash, challenge.region, now);
  createSession(user, res);
});

app.post('/api/auth/resend-otp', async (req, res) => {
  const challengeId = String(req.body.challengeId || '');
  const challenge = db.prepare('SELECT * FROM authChallenges WHERE id = ? AND usedAt IS NULL').get(challengeId);
  if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ status: 'error', message: 'This verification request has expired. Sign in again.' });
  }
  if (Date.now() - new Date(challenge.lastSentAt).getTime() < 60000) {
    return res.status(429).json({ status: 'error', message: 'Please wait before requesting another code.' });
  }
  const transport = createSmtpTransport();
  if (!transport) return res.status(503).json({ status: 'error', message: 'Email verification is not configured. Please contact support.' });
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(challenge.userId);
  if (!user) return res.status(400).json({ status: 'error', message: 'This account is no longer available.' });

  const code = String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  const codeHash = crypto.createHash('sha256').update(challengeId + ':' + code).digest('hex');
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Your StreamSphere sign-in verification code',
      text: 'Your verification code is ' + code + '. It expires in 5 minutes. If you did not try to sign in, you can ignore this email.'
    });
    db.prepare(`
      UPDATE authChallenges SET codeHash = ?, attempts = 0, createdAt = ?, expiresAt = ?, lastSentAt = ?
      WHERE id = ?
    `).run(codeHash, now.toISOString(), new Date(now.getTime() + 5 * 60 * 1000).toISOString(), now.toISOString(), challengeId);
    res.json({ status: 'success', message: 'A new verification code was sent.' });
  } catch (error) {
    console.error('Unable to resend sign-in verification email:', error.message);
    res.status(502).json({ status: 'error', message: 'Unable to send a new verification email. Please try again later.' });
  }
});

function getSessionUser(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.plan, u.theme, u.mobile, u.location
    FROM userSessions s JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ? AND s.expiresAt > ?
  `).get(tokenHash, new Date().toISOString()) || null;
}

app.get('/api/profile', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Please sign in again.' });
  res.json({ status: 'success', profile: user });
});

app.put('/api/profile', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Please sign in again.' });
  const { theme, mobile, location } = req.body || {};
  if (!['auto', 'light', 'dark'].includes(theme)) {
    return res.status(400).json({ status: 'error', message: 'Choose Auto, Light, or Dark theme.' });
  }
  const savedMobile = String(mobile || '').trim().slice(0, 30);
  const savedLocation = String(location || '').trim().slice(0, 120);
  db.prepare('UPDATE users SET theme = ?, mobile = ?, location = ? WHERE id = ?')
    .run(theme, savedMobile, savedLocation, user.id);
  res.json({ status: 'success', profile: { ...user, theme, mobile: savedMobile, location: savedLocation } });
});

app.post('/api/plans/upgrade', (req, res) => {
  const { email, plan } = req.body;
  db.prepare('UPDATE users SET plan = ? WHERE email = ?').run(plan, email);
  res.json({ status: 'success', plan });
});

app.listen(PORT, () => {
  console.log(`StreamSphere running on http://localhost:${PORT}`);
});
