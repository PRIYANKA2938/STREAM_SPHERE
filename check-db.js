const db = require('./database');

console.log('\n======================================');
console.log('       STREAMSPHERE DATABASE CHECK');
console.log('======================================\n');

// 1. Users table
console.log('--- 1. USERS ---');
const users = db.prepare('SELECT id, name, email, plan, theme, mobile, createdAt FROM users').all();
if (users.length === 0) console.log('(No users registered yet)');
else console.table(users);

// 2. Downloads table
console.log('\n--- 2. DOWNLOADED VIDEOS ---');
const downloads = db.prepare('SELECT id, userEmail, videoTitle, plan, downloadDate FROM downloads').all();
if (downloads.length === 0) console.log('(No downloads recorded yet)');
else console.table(downloads);

// 3. Comments table
console.log('\n--- 3. COMMENTS ---');
const comments = db.prepare('SELECT id, username, text, language, timestamp FROM comments ORDER BY timestamp DESC LIMIT 10').all();
if (comments.length === 0) console.log('(No comments posted yet)');
else console.table(comments);

// 4. Payments table
console.log('\n--- 4. PAYMENTS / TRANSACTIONS ---');
const payments = db.prepare('SELECT id, userEmail, plan, amount, status, createdAt FROM payments').all();
if (payments.length === 0) console.log('(No payment transactions yet)');
else console.table(payments);

console.log('\n======================================\n');
