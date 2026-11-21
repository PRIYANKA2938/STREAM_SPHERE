const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'streamsphere.db'));

// Enable Write-Ahead Logging for speed & concurrency
db.pragma('journal_mode = WAL');

// 1. Comments table
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    videoId TEXT DEFAULT 'main',
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    city TEXT,
    timestamp TEXT NOT NULL,
    isReported INTEGER DEFAULT 0,
    isRemoved INTEGER DEFAULT 0,
    isPinned INTEGER DEFAULT 0,
    replyCount INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en',
    showLocation INTEGER DEFAULT 0,
    authorId TEXT DEFAULT '',
    parentCommentId TEXT,
    publicRegion TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reactions (
    commentId TEXT NOT NULL,
    reactorId TEXT NOT NULL,
    reaction TEXT CHECK(reaction IN ('like', 'dislike')),
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (commentId, reactorId)
  );

  CREATE TABLE IF NOT EXISTS videoReactions (
    videoId TEXT NOT NULL,
    reactorId TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK(reaction IN ('like', 'dislike')),
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (videoId, reactorId)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    theme TEXT DEFAULT 'auto',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trustedLoginDevices (
    userId TEXT NOT NULL,
    deviceHash TEXT NOT NULL,
    region TEXT NOT NULL,
    lastSeenAt TEXT NOT NULL,
    PRIMARY KEY (userId, deviceHash, region)
  );

  CREATE TABLE IF NOT EXISTS authChallenges (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    codeHash TEXT NOT NULL,
    deviceHash TEXT NOT NULL,
    region TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    lastSentAt TEXT NOT NULL,
    usedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS userSessions (
    tokenHash TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appMigrations (
    name TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  userEmail TEXT NOT NULL,
  videoId TEXT NOT NULL,
  videoTitle TEXT,
  downloadDate TEXT NOT NULL,
  plan TEXT NOT NULL,
  videoUrl TEXT
);

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    paymentId TEXT,
    userEmail TEXT NOT NULL,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );


  CREATE TABLE IF NOT EXISTS commentReports (
    commentId TEXT NOT NULL,
    reporterId TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    PRIMARY KEY (commentId, reporterId)
  );
`);

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
[
  ['mobile', "TEXT NOT NULL DEFAULT ''"],
  ['location', "TEXT NOT NULL DEFAULT ''"]
].forEach(([name, definition]) => {
  if (!userColumns.has(name)) {
    db.exec('ALTER TABLE users ADD COLUMN ' + name + ' ' + definition);
  }
});

const autoThemeMigration = db.prepare('SELECT 1 FROM appMigrations WHERE name = ?').get('user-theme-auto-default');
if (!autoThemeMigration) {
  db.prepare("UPDATE users SET theme = 'auto' WHERE theme = 'dark'").run();
  db.prepare('INSERT INTO appMigrations (name, appliedAt) VALUES (?, ?)').run('user-theme-auto-default', new Date().toISOString());
}

const commentColumns = new Set(db.prepare('PRAGMA table_info(comments)').all().map(column => column.name));
[
  ['language', "TEXT DEFAULT 'en'"],
  ['showLocation', 'INTEGER DEFAULT 0'],
  ['authorId', "TEXT DEFAULT ''"],
  ['parentCommentId', 'TEXT'],
  ['publicRegion', "TEXT DEFAULT ''"],
  ['isRemoved', 'INTEGER DEFAULT 0']
].forEach(([name, definition]) => {
  if (!commentColumns.has(name)) {
    db.exec('ALTER TABLE comments ADD COLUMN ' + name + ' ' + definition);
  }
});

const downloadColumns = new Set(db.prepare('PRAGMA table_info(downloads)').all().map(column => column.name));
if (!downloadColumns.has('videoUrl')) {
  db.exec("ALTER TABLE downloads ADD COLUMN videoUrl TEXT");
}

module.exports = db;
