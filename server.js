const express  = require('express');
const Database = require('better-sqlite3');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const path     = require('path');
const http     = require('http');
const crypto   = require('crypto');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const db = new Database('tandem.db');
db.pragma('journal_mode = WAL');
console.log('📁 Database:', path.resolve('tandem.db'));

// ─── Core helpers ─────────────────────────────────────────────
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  return sql.trim().toUpperCase().startsWith('SELECT') ? stmt.all(params) : stmt.run(params);
}
function logStats() {
  try {
    const u = query('SELECT COUNT() as c FROM users')[0]?.c || 0;
    const s = query("SELECT COUNT() as c FROM sessions WHERE status IN ('pending','active','confirmed')")[0]?.c || 0;
    console.log(`📊 Users:${u} | ActiveSess:${s}`);
  } catch(e) {}
}
function createNotification(recipientEmail, type, title, body, extra = {}) {
  try {
    query(`INSERT INTO notifications (recipient_email,type,title,body,data,is_read,created_at) VALUES (?,?,?,?,?,0,datetime('now','localtime'))`,
      [recipientEmail, type, title, body, JSON.stringify(extra)]);
  } catch(e) { console.error('notif error:', e); }
}
function emitCreditUpdate(email, newCredits) {
  io.to(`user:${email}`).emit('credits-updated', { credits: newCredits });
}
function awardCredits(recipientEmail, amount, type, description, extra = {}) {
  try {
    const r = query('SELECT credits FROM users WHERE email=?', [recipientEmail]);
    if (!r.length) return;
    const newCredits = parseFloat(((r[0].credits || 0) + amount).toFixed(2));
    query('UPDATE users SET credits=? WHERE email=?', [newCredits, recipientEmail]);
    query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))`,
      ['system', recipientEmail, amount, type, extra.session_id || null]);
    createNotification(recipientEmail, 'credit_gain', `+${amount} credit(s)`, description, { amount, ...extra });
    emitCreditUpdate(recipientEmail, newCredits);
    return newCredits;
  } catch(e) { console.error('awardCredits error:', e); }
}
function deductCredits(email, amount, type, description, extra = {}) {
  try {
    const r = query('SELECT credits FROM users WHERE email=?', [email]);
    if (!r.length) return null;
    const newCredits = parseFloat(((r[0].credits || 0) - amount).toFixed(2));
    query('UPDATE users SET credits=? WHERE email=?', [newCredits, email]);
    query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))`,
      [email, 'system', amount, type, extra.session_id || null]);
    createNotification(email, 'credit_loss', `-${amount} credit(s)`, description, { amount: -amount, ...extra });
    emitCreditUpdate(email, newCredits);
    return newCredits;
  } catch(e) { console.error('deductCredits error:', e); }
}

// ─── AUTH ─────────────────────────────────────────────────────
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.json({ success: false, message: 'All fields required' });
  try {
    if (query('SELECT id FROM users WHERE email=?', [email]).length)
      return res.json({ success: false, message: 'Email already registered' });
    query("INSERT INTO users (name,email,password,credits,created_at) VALUES (?,?,?,5,datetime('now','localtime'))",
      [name, email, bcrypt.hashSync(password, 10)]);
    createNotification(email, 'system', 'Welcome to Tandem!', 'You have 5 starter credits. Complete your profile to get started.', {});
    logStats();
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const rows = query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length || !bcrypt.compareSync(password, rows[0].password))
      return res.json({ success: false, message: 'Invalid email or password' });
    const u = rows[0];
    checkLoginStreak(email);
    res.json({ success: true, name: u.name, username: u.username || '', bio: u.bio || '',
      achievements: u.achievements || '', skills: u.skills || '[]', growth: u.growth || '[]',
      credits: u.credits || 5, profile_pic: u.profile_pic || '', grade_level: u.grade_level || '',
      profile_completed: u.profile_completed || 0 });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/complete-profile', (req, res) => {
  const { email, username, skills, growth, profile_pic, bio, achievements, grade_level } = req.body;
  try {
    const taken = query('SELECT id FROM users WHERE username=? AND email!=?', [username, email]);
    if (taken.length) return res.json({ success: false, message: 'That username is already taken. Please choose another.' });

    query(`UPDATE users SET username=?,skills=?,growth=?,profile_pic=?,bio=?,achievements=?,grade_level=?,profile_completed=1 WHERE email=?`,
      [username, JSON.stringify(skills), JSON.stringify(growth), profile_pic || null, bio || '', achievements || '', grade_level || '', email]);
    checkAndAwardQuest(email, 'profile_complete');
    res.json({ success: true });
  } catch(e) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/update-profile', (req, res) => {
  const { email, name, username, bio, achievements, skills, growth, grade_level, profile_pic } = req.body;
  try {
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
      if (!usernameRegex.test(username)) return res.json({ success: false, message: 'Invalid username format.' });
      const taken = query('SELECT id FROM users WHERE username=? AND email!=?', [username, email]);
      if (taken.length) return res.json({ success: false, message: 'Username already taken.' });
    }
    query(`UPDATE users SET name=COALESCE(?,name),username=COALESCE(?,username),bio=COALESCE(?,bio),achievements=COALESCE(?,achievements),
           skills=COALESCE(?,skills),growth=COALESCE(?,growth),grade_level=COALESCE(?,grade_level),
           profile_pic=COALESCE(?,profile_pic) WHERE email=?`,
      [name||null, username||null, bio||null, achievements||null, skills?JSON.stringify(skills):null,
       growth?JSON.stringify(growth):null, grade_level||null, profile_pic||null, email]);
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

app.post('/update-credits', (req, res) => {
  const { email, credits } = req.body;
  try { query('UPDATE users SET credits=? WHERE email=?', [credits, email]); emitCreditUpdate(email, credits); res.json({ success: true }); }
  catch(e) { res.json({ success: false }); }
});

app.post('/get-user-data', (req, res) => {
  const { email } = req.body;
  try {
    const r = query('SELECT name,username,bio,achievements,skills,growth,credits,grade_level,profile_pic,rating FROM users WHERE email=?', [email]);
    if (!r.length) return res.json({ success: false, message: 'User not found' });
    const u = r[0];
    res.json({ success: true, credits: u.credits || 5, bio: u.bio || '', achievements: u.achievements || '',
      skills: u.skills || '[]', growth: u.growth || '[]', grade_level: u.grade_level || '',
      profile_pic: u.profile_pic || '', rating: u.rating || 0, name: u.name, username: u.username || '' });
  } catch(e) { res.json({ success: false }); }
});

// ─── PROFILE STATS ────────────────────────────────────────────
app.post('/get-profile-stats', (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false });
  try {
    const sessionsCompleted = query("SELECT COUNT() as c FROM sessions WHERE learner_email=? AND status='completed'", [email])[0]?.c || 0;
    const sessionsMentored  = query("SELECT COUNT() as c FROM sessions WHERE tutor_email=? AND status='completed'", [email])[0]?.c || 0;
    const ratingRow = query("SELECT AVG(rating) as avg, COUNT(rating) as cnt FROM sessions WHERE tutor_email=? AND rating IS NOT NULL", [email])[0];
    const avgRating  = ratingRow?.avg ? parseFloat(ratingRow.avg.toFixed(1)) : 0;
    const ratingCount = ratingRow?.cnt || 0;
    res.json({ success: true, sessionsCompleted, sessionsMentored, avgRating, ratingCount });
  } catch(e) { console.error(e); res.json({ success: false, sessionsCompleted: 0, sessionsMentored: 0, avgRating: 0, ratingCount: 0 }); }
});

// ─── FORGOT / RESET PASSWORD ──────────────────────────────────
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  try {
    if (!query('SELECT id FROM users WHERE email=?', [email]).length)
      return res.json({ success: false, message: 'Email not found' });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    query(`INSERT INTO password_resets (email,token,expires_at,used,created_at) VALUES (?,?,?,0,datetime('now','localtime'))`,
      [email, token, expires]);
    const resetLink = `http://localhost:3000/index.html?token=${token}`;
    console.log(`Password reset for ${email}: ${resetLink}`);
    res.json({ success: true, message: 'Reset link generated', resetLink, token });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.json({ success: false, message: 'Missing fields' });
  try {
    const rows = query(`SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at>datetime('now','localtime')`, [token]);
    if (!rows.length) return res.json({ success: false, message: 'Invalid or expired reset link' });
    query('UPDATE users SET password=? WHERE email=?', [bcrypt.hashSync(newPassword, 10), rows[0].email]);
    query('UPDATE password_resets SET used=1 WHERE token=?', [token]);
    res.json({ success: true, message: 'Password reset successful' });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

// ─── AI CHAT ──────────────────────────────────────────────────
app.post('/ai-chat', async (req, res) => {
  const { messages, systemPrompt } = req.body;
  if (!messages?.length) return res.json({ success: false, reply: null });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ success: false, reply: null });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 800,
        system: systemPrompt || 'You are a helpful academic tutor assistant.',
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const data = await response.json();
    const reply = data.content?.[0]?.text || "I couldn't generate a response. Please try again.";
    res.json({ success: true, reply });
  } catch(e) { console.error('AI chat error:', e); res.json({ success: false, reply: null }); }
});

// ─── ENHANCED MATCHING ────────────────────────────────────────
// Filter out system/AI accounts from matches
const SYSTEM_ACCOUNTS = ['system', '__tandem_ai_bot__'];

app.post('/get-swipe-matches', (req, res) => {
  const { email } = req.body;
  try {
    const cu = query('SELECT skills,growth,grade_level FROM users WHERE email=?', [email]);
    let uSkills = [], uGrowth = [], uGrade = '';
    if (cu.length) {
      try { uSkills = JSON.parse(cu[0].skills||'[]'); uGrowth = JSON.parse(cu[0].growth||'[]'); uGrade = cu[0].grade_level||''; } catch(e) {}
    }

    const e1 = query(
      `SELECT DISTINCT CASE WHEN learner_email=? THEN tutor_email ELSE learner_email END as e
       FROM connection_requests WHERE (learner_email=? OR tutor_email=?) AND status IN('pending','accepted')`,
      [email,email,email]).map(r=>r.e).filter(Boolean);
    const e2 = query(
      `SELECT DISTINCT CASE WHEN user1_email=? THEN user2_email ELSE user1_email END as e
       FROM connections WHERE user1_email=? OR user2_email=?`,
      [email,email,email]).map(r=>r.e).filter(Boolean);
    const excl = [...new Set([...e1,...e2,...SYSTEM_ACCOUNTS])];

    const ph = excl.map(()=>'?').join(',');
    const others = excl.length
      ? query(`SELECT email,name,username,bio,skills,growth,rating,profile_pic,credits,grade_level FROM users WHERE email!=? AND email NOT IN(${ph})`, [email,...excl])
      : query("SELECT email,name,username,bio,skills,growth,rating,profile_pic,credits,grade_level FROM users WHERE email!=?", [email]);

    const gc = {
      elementary:   ['elementary','junior_high'],
      junior_high:  ['elementary','junior_high','senior_high'],
      senior_high:  ['junior_high','senior_high','college'],
      college:      ['senior_high','college','postgrad'],
      postgrad:     ['college','postgrad','professional'],
      professional: ['postgrad','professional']
    };

    const matches = others.map(o => {
      let os = [], og = '';
      try { os = JSON.parse(o.skills||'[]'); og = o.grade_level||''; } catch(e) {}
      const compat = uGrade && og ? (gc[uGrade]||[]).includes(og) : true;
      let sc = 0, tw = 0;
      uGrowth.forEach(g => {
        if (os.some(s => s.toLowerCase()===g.toLowerCase())) sc += 100;
        tw += 100;
      });
      const skillScore  = tw > 0 ? (sc/tw)*100 : 0;
      const ratingScore = (o.rating||0)/5*20;
      let feedbackScore = 0;
      try {
        const fb = query(`SELECT AVG(CASE sentiment WHEN 'positive' THEN 100 WHEN 'neutral' THEN 50 ELSE 0 END) as avg_sent, COUNT(*) as cnt FROM session_feedback WHERE tutor_email=?`, [o.email]);
        if (fb[0]?.cnt > 0) feedbackScore = (fb[0].avg_sent||0)/100*20;
      } catch(e) {}
      let sessBonus = 0;
      try {
        const sc2 = query("SELECT COUNT(*) as c FROM sessions WHERE tutor_email=? AND status='completed'", [o.email]);
        sessBonus = Math.min(sc2[0]?.c||0, 10);
      } catch(e) {}
      const rawScore   = skillScore*(compat?1:0.3)+ratingScore+feedbackScore+sessBonus;
      const matchScore = Math.round(Math.min(rawScore,100));
      let feedbackHighlights = [];
      try {
        feedbackHighlights = query(`SELECT comment FROM session_feedback WHERE tutor_email=? AND sentiment='positive' AND comment!='' ORDER BY created_at DESC LIMIT 2`, [o.email]).map(f=>f.comment);
      } catch(e) {}
      return { ...o, matchScore, rating: o.rating||0, grade_compatible: compat, feedbackHighlights };
    });

    res.json({ success: true, matches: matches.sort((a,b)=>b.matchScore-a.matchScore) });
  } catch(e) { console.error(e); res.json({ success: false, matches: [] }); }
});

// ─── CONNECTIONS ──────────────────────────────────────────────
app.post('/send-connection-request', (req, res) => {
  const { learnerEmail, tutorEmail, subject, message, learnerGradeLevel, tutorGradeLevel } = req.body;
  try {
    const gc = { elementary:['elementary','junior_high'], junior_high:['elementary','junior_high','senior_high'], senior_high:['junior_high','senior_high','college'], college:['senior_high','college','postgrad'], postgrad:['college','postgrad','professional'], professional:['postgrad','professional'] };
    if (tutorGradeLevel && !(gc[learnerGradeLevel]||[]).includes(tutorGradeLevel))
      return res.json({ success: false, message: 'Grade level mismatch.' });
    if (query("SELECT id FROM connection_requests WHERE learner_email=? AND tutor_email=? AND status IN('pending','accepted')", [learnerEmail,tutorEmail]).length)
      return res.json({ success: false, message: 'Request already exists.' });
    if (query('SELECT id FROM connections WHERE (user1_email=? AND user2_email=?) OR (user1_email=? AND user2_email=?)', [learnerEmail,tutorEmail,tutorEmail,learnerEmail]).length)
      return res.json({ success: false, message: 'Already connected!' });

    query("INSERT INTO connection_requests (learner_email,tutor_email,subject,message,status,created_at) VALUES (?,?,?,?,'pending',datetime('now','localtime'))",
      [learnerEmail,tutorEmail,subject,message||'']);

    const ln    = query('SELECT name,username FROM users WHERE email=?', [learnerEmail]);
    const lName = ln[0]?.username||ln[0]?.name||'A learner';
    createNotification(tutorEmail, 'connection_request', `Connection request from @${lName}`, `Wants to learn: "${subject||'General'}"`, { learner_email:learnerEmail, subject, message });

    const tn = query('SELECT name,username FROM users WHERE email=?', [tutorEmail]);
    createNotification(learnerEmail, 'connection_request_sent', 'Connection Request sent!', `Sent to @${tn[0]?.username||tn[0]?.name||'mentor'}.`, { tutor_email:tutorEmail, subject });

    logStats();
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/get-pending-requests', (req, res) => {
  const { email } = req.body;
  try {
    res.json({ success: true, requests: query(
      `SELECT cr.*,u.name as learner_name,u.username as learner_username,u.profile_pic as learner_profile_pic,u.grade_level as learner_grade,u.bio as learner_bio
       FROM connection_requests cr JOIN users u ON cr.learner_email=u.email
       WHERE cr.tutor_email=? AND cr.status='pending' ORDER BY cr.created_at DESC`,
      [email]) });
  } catch(e) { res.json({ success: false, requests: [] }); }
});

app.post('/accept-request', (req, res) => {
  const { requestId, tutorEmail, learnerEmail } = req.body;
  try {
    query("UPDATE connection_requests SET status='accepted',updated_at=datetime('now','localtime') WHERE id=?", [requestId]);
    query("INSERT INTO connections (user1_email,user2_email,status,created_at) VALUES (?,?,'active',datetime('now','localtime'))", [learnerEmail,tutorEmail]);
    const tn = query('SELECT name,username FROM users WHERE email=?', [tutorEmail]);
    const tutorHandle = tn[0]?.username ? `@${tn[0].username}` : (tn[0]?.name || 'Your mentor');
    createNotification(learnerEmail, 'connection_accepted', 'Connection accepted!', `${tutorHandle} accepted your connection request. You can now request sessions.`, { tutor_email: tutorEmail });
    checkAndAwardQuest(learnerEmail, 'first_connection');
    logStats();
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false }); }
});

app.post('/reject-request', (req, res) => {
  const { requestId } = req.body;
  try {
    const r = query('SELECT * FROM connection_requests WHERE id=?', [requestId]);
    query("UPDATE connection_requests SET status='rejected',updated_at=datetime('now','localtime') WHERE id=?", [requestId]);
    if (r.length) {
      const tn = query('SELECT name,username FROM users WHERE email=?', [r[0].tutor_email]);
      createNotification(r[0].learner_email, 'connection_rejected', 'Connection declined', `${tn[0]?.username||tn[0]?.name||'Mentor'} could not accept.`, { tutor_email: r[0].tutor_email });
    }
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

app.post('/get-connections', (req, res) => {
  const { email } = req.body;
  try {
    res.json({ success: true, connections: query(
      `SELECT CASE WHEN c.user1_email=? THEN c.user2_email ELSE c.user1_email END as connected_email,
              u.name as connected_name,u.username as connected_username,u.profile_pic as connected_profile_pic,c.created_at as connected_at
       FROM connections c JOIN users u ON (u.email=c.user1_email OR u.email=c.user2_email)
       WHERE (c.user1_email=? OR c.user2_email=?) AND u.email!=? ORDER BY c.created_at DESC`,
      [email,email,email,email]) });
  } catch(e) { res.json({ success: false, connections: [] }); }
});

app.post('/get-requestable-subjects', (req, res) => {
  const { learnerEmail, tutorEmail } = req.body;
  try {
    const connReq = query("SELECT subject FROM connection_requests WHERE learner_email=? AND tutor_email=? AND status='accepted' ORDER BY id DESC LIMIT 1", [learnerEmail,tutorEmail]);
    if (connReq.length && connReq[0].subject) {
      const subjects = connReq[0].subject.split(',').map(s=>s.trim()).filter(Boolean);
      if (subjects.length) return res.json({ success: true, subjects });
    }
    const learner = query('SELECT growth FROM users WHERE email=?', [learnerEmail]);
    const tutor   = query('SELECT skills FROM users WHERE email=?', [tutorEmail]);
    let growth = [], skills = [];
    try { growth = JSON.parse(learner[0]?.growth||'[]'); skills = JSON.parse(tutor[0]?.skills||'[]'); } catch(e) {}
    const skillsLower = skills.map(s=>s.toLowerCase());
    const subjects = growth.filter(g=>skillsLower.includes(g.toLowerCase()));
    res.json({ success: true, subjects: subjects.length ? subjects : skills.slice(0,10) });
  } catch(e) { console.error(e); res.json({ success: false, subjects: [] }); }
});

// ─── MESSAGES ─────────────────────────────────────────────────
app.post('/get-messages', (req, res) => {
  const { user1Email, user2Email } = req.body;
  try {
    const msgs = query(
      `SELECT * FROM messages WHERE (sender_email=? AND receiver_email=?) OR (sender_email=? AND receiver_email=?) ORDER BY created_at ASC`,
      [user1Email,user2Email,user2Email,user1Email]);
    query(`UPDATE messages SET is_read=1 WHERE receiver_email=? AND sender_email=? AND is_read=0`, [user1Email,user2Email]);
    res.json({ success: true, messages: msgs });
  } catch(e) { res.json({ success: false, messages: [] }); }
});

app.post('/send-message', (req, res) => {
  const { senderEmail, receiverEmail, message } = req.body;
  try {
    query("INSERT INTO messages (sender_email,receiver_email,message,is_read,created_at) VALUES (?,?,?,0,datetime('now','localtime'))",
      [senderEmail,receiverEmail,message]);
    const sn    = query('SELECT name,username FROM users WHERE email=?', [senderEmail]);
    const sName = sn[0]?.username||sn[0]?.name||'Someone';
    const recent = query(
      `SELECT id FROM notifications WHERE recipient_email=? AND type='new_message' AND json_extract(data,'$.sender_email')=? AND created_at>datetime('now','-5 minutes','localtime')`,
      [receiverEmail,senderEmail]);
    if (!recent.length)
      createNotification(receiverEmail, 'new_message', `New message from ${sName}`, message.length>60?message.slice(0,57)+'...':message, { sender_email:senderEmail });
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

// ─── CHECK UNRATED SESSION (blocks new session requests) ──────
app.post('/check-unrated-session', (req, res) => {
  const { email } = req.body;
  try {
    // Find any recently completed session (last 7 days) where learner has not rated
    const unrated = query(
      `SELECT id, tutor_email, subject, elapsed_seconds, session_end
       FROM sessions WHERE learner_email=? AND status='completed' AND (rating IS NULL OR rating=0)
       AND session_end >= datetime('now','-7 days','localtime')
       ORDER BY session_end DESC LIMIT 1`,
      [email]);
    if (unrated.length) {
      const s = unrated[0];
      const tutorUser = query('SELECT name,username FROM users WHERE email=?', [s.tutor_email]);
      const tutorName = tutorUser[0]?.username || tutorUser[0]?.name || 'Your mentor';
      return res.json({ success: true, hasUnrated: true, session: { ...s, tutor_name: tutorName } });
    }
    res.json({ success: true, hasUnrated: false });
  } catch(e) { res.json({ success: false, hasUnrated: false }); }
});

// ─── ADD THIS ROUTE to server.js (before initDatabase) ───────
// Returns the most recent completed session that the learner hasn't rated yet,
// so messages.js can block a new session request until the learner rates.

app.post('/get-unrated-session', (req, res) => {
    const { learnerEmail, tutorEmail } = req.body;
    if (!learnerEmail || !tutorEmail) return res.json({ success: false, session: null });
    try {
        const rows = query(
            `SELECT * FROM sessions
             WHERE learner_email=? AND tutor_email=? AND status='completed' AND (rating IS NULL OR rating=0)
             ORDER BY session_end DESC LIMIT 1`,
            [learnerEmail, tutorEmail]
        );
        res.json({ success: true, session: rows.length ? rows[0] : null });
    } catch(e) { res.json({ success: false, session: null }); }
});

// ─── SESSIONS ─────────────────────────────────────────────────
app.post('/send-session-request', (req, res) => {
  const { learnerEmail, tutorEmail, subject, sessionNotes, sessionType, sessionMode, preferredTime } = req.body;
  try {
    // Check for unrated completed session first
    const unrated = query(
      `SELECT id FROM sessions WHERE learner_email=? AND status='completed' AND (rating IS NULL OR rating=0)
       AND session_end >= datetime('now','-7 days','localtime')`,
      [learnerEmail]);
    if (unrated.length)
      return res.json({ success: false, message: 'Please rate your last session before requesting a new one.', requiresRating: true });

    const existing = query(
      `SELECT id FROM sessions WHERE ((learner_email=? AND tutor_email=?) OR (learner_email=? AND tutor_email=?))
       AND status IN ('pending','active','confirmed','scheduled','rescheduling')`,
      [learnerEmail,tutorEmail,tutorEmail,learnerEmail]);
    if (existing.length) return res.json({ success: false, message: 'You already have a pending or active session with this user.' });

    const lr = query('SELECT credits FROM users WHERE email=?', [learnerEmail]);
    if (!lr.length || lr[0].credits < 1) return res.json({ success: false, message: 'You need at least 1 credit.' });

    query(`INSERT INTO sessions (learner_email,tutor_email,subject,session_notes,session_type,session_mode,preferred_time,status,created_at)
           VALUES (?,?,?,?,?,?,?,'pending',datetime('now','localtime'))`,
      [learnerEmail,tutorEmail,subject,sessionNotes||'',sessionType||'solo',sessionMode||'online',preferredTime||null]);

    const sid   = query('SELECT id FROM sessions WHERE learner_email=? AND tutor_email=? ORDER BY id DESC LIMIT 1', [learnerEmail,tutorEmail])[0]?.id;
    const ln    = query('SELECT name,username FROM users WHERE email=?', [learnerEmail]);
    const lName = ln[0]?.username||ln[0]?.name||'A learner';
    const typeLabel = sessionType==='group'?'Group':'One-on-One';
    const modeLabel = sessionMode==='face_to_face'?'Face-to-Face':'Online';
    const timeStr   = preferredTime ? ` · Preferred: ${new Date(preferredTime).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})}` : '';

    createNotification(tutorEmail, 'session_request', `Session request from ${lName}`,
      `${typeLabel} · ${modeLabel} · "${subject||'General'}"${timeStr}`,
      { session_id:sid, learner_email:learnerEmail, subject, session_type:sessionType, session_mode:sessionMode, preferred_time:preferredTime });

    logStats();
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/accept-session-request', (req, res) => {
  const { sessionId, tutorEmail, learnerEmail } = req.body;
  try {
    const sess = query(`SELECT * FROM sessions WHERE id=? AND tutor_email=? AND status='pending'`, [sessionId,tutorEmail]);
    if (!sess.length) return res.json({ success: false, message: 'Session not found' });
    const s = sess[0];
    const now = new Date().toISOString();
    query(`UPDATE sessions SET status='confirmed', scheduled_time = (SELECT COALESCE(preferred_time, datetime('now','localtime')) FROM sessions WHERE id=?), updated_at=datetime('now','localtime') WHERE id=?`, [sessionId, sessionId]);
      const updatedSess = query('SELECT scheduled_time FROM sessions WHERE id=?', [sessionId])[0];
      const confirmedTime = updatedSess?.scheduled_time || s.preferred_time;
    
    createNotification(learnerEmail, 'session_confirmed', 'Session confirmed!', `"${s.subject||'Session'}" confirmed. Join from Calendar.`,
       { session_id:sessionId, scheduled_time:confirmedTime, tutor_email:tutorEmail, session_mode:s.session_mode, subject:s.subject });
    createNotification(tutorEmail, 'schedule_accepted', 'Session confirmed', `Ready to start "${s.subject||'Session'}" when you are.`,
      { session_id:sessionId, learner_email:learnerEmail });
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/propose-schedule', (req, res) => {
  const { sessionId, tutorEmail, learnerEmail, scheduledTime, tutorName } = req.body;
  if (!sessionId||!tutorEmail||!learnerEmail||!scheduledTime) return res.json({ success: false, message: 'Missing fields' });
  try {
    const sess = query(`SELECT * FROM sessions WHERE id=? AND tutor_email=? AND status IN ('pending','rescheduling')`, [sessionId,tutorEmail]);
    if (!sess.length) return res.json({ success: false, message: 'Session not found or already handled' });
    const s = sess[0];
    query(`UPDATE sessions SET status='scheduled',scheduled_time=?,updated_at=datetime('now','localtime') WHERE id=?`, [scheduledTime,sessionId]);
    const pretty = new Date(scheduledTime).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    createNotification(learnerEmail, 'session_scheduled', `${tutorName||'Your mentor'} proposed a time`,
      `${pretty} — "${s.subject||'Session'}". Accept or suggest a new time.`,
      { session_id:sessionId, scheduled_time:scheduledTime, tutor_email:tutorEmail, tutor_name:tutorName, subject:s.subject, session_type:s.session_type, session_mode:s.session_mode });
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/respond-schedule', (req, res) => {
  const { sessionId, learnerEmail, learnerName, accepted, newTime } = req.body;
  if (!sessionId||!learnerEmail) return res.json({ success: false, message: 'Missing fields' });
  try {
    const sess = query(`SELECT * FROM sessions WHERE id=? AND learner_email=? AND status='scheduled'`, [sessionId,learnerEmail]);
    if (!sess.length) return res.json({ success: false, message: 'Session not found' });
    const s = sess[0];
    if (accepted) {
      query(`UPDATE sessions SET status='confirmed',updated_at=datetime('now','localtime') WHERE id=?`, [sessionId]);
      const pretty = new Date(s.scheduled_time).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
      createNotification(s.tutor_email, 'schedule_accepted', `${learnerName||'Learner'} confirmed`, `"${s.subject||'Session'}" confirmed for ${pretty}.`, { session_id:sessionId, learner_email:learnerEmail });
      createNotification(learnerEmail, 'session_confirmed', 'Session confirmed!', `"${s.subject||'Session'}" confirmed for ${pretty}.`, { session_id:sessionId, scheduled_time:s.scheduled_time, tutor_email:s.tutor_email, session_mode:s.session_mode, subject:s.subject });
      res.json({ success: true, message: 'Confirmed!' });
    } else if (newTime) {
      query(`UPDATE sessions SET status='rescheduling',scheduled_time=?,updated_at=datetime('now','localtime') WHERE id=?`, [newTime,sessionId]);
      const pretty = new Date(newTime).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
      createNotification(s.tutor_email, 'reschedule_request', `${learnerName||'Learner'} suggested a new time`, `New suggestion: ${pretty} — "${s.subject||'Session'}".`, { session_id:sessionId, learner_email:learnerEmail, new_time:newTime, subject:s.subject });
      res.json({ success: true, message: 'Counter-proposal sent.' });
    } else {
      query(`UPDATE sessions SET status='rejected',updated_at=datetime('now','localtime') WHERE id=?`, [sessionId]);
      createNotification(s.tutor_email, 'schedule_declined', `${learnerName||'Learner'} cancelled`, `"${s.subject||'Session'}" cancelled.`, { session_id:sessionId });
      res.json({ success: true, message: 'Cancelled.' });
    }
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/start-session', (req, res) => {
  const { sessionId, tutorEmail } = req.body;
  try {
    const sess = query(`SELECT * FROM sessions WHERE id=? AND tutor_email=? AND status='confirmed'`, [sessionId,tutorEmail]);
    if (!sess.length) return res.json({ success: false, message: 'Session not confirmed yet.' });
    const s = sess[0];
    const lr = query('SELECT credits FROM users WHERE email=?', [s.learner_email]);
    if (!lr.length || lr[0].credits < 1) return res.json({ success: false, message: 'Learner has insufficient credits.' });

    const newLearnerCredits = parseFloat((lr[0].credits - 1).toFixed(2));
    query('UPDATE users SET credits=? WHERE email=?', [newLearnerCredits, s.learner_email]);
    query(`UPDATE sessions SET status='active',session_start=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?`, [sessionId]);
    query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,1,'session_payment',?,datetime('now','localtime'))`,
      [s.learner_email, tutorEmail, sessionId]);

    createNotification(s.learner_email, 'session_started', 'Session started!',
      `Your mentor started "${s.subject||'Session'}". Join from Messages or Calendar.`,
      { session_id:sessionId, tutor_email:tutorEmail, session_mode:s.session_mode, subject:s.subject });
    createNotification(s.learner_email, 'credit_loss', '1 credit spent', `Deducted for "${s.subject||'Session'}".`, { session_id:sessionId, amount:-1 });

    emitCreditUpdate(s.learner_email, newLearnerCredits);

    if (s.session_mode === 'face_to_face') {
      io.to(`user:${s.learner_email}`).emit('f2f-session-started', { sessionId });
    }

    logStats();
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/learner-confirm-f2f', (req, res) => {
  const { sessionId, learnerEmail } = req.body;
  try {
    const sess = query(`SELECT * FROM sessions WHERE id=? AND learner_email=? AND status='active' AND session_mode='face_to_face'`, [sessionId, learnerEmail]);
    if (!sess.length) return res.json({ success: false, message: 'Session not found.' });
    const s = sess[0];
    if (!s.learner_confirmed_at) {
      query(`UPDATE sessions SET learner_confirmed_at=datetime('now','localtime') WHERE id=?`, [sessionId]);
    }
    createNotification(s.tutor_email, 'f2f_learner_confirmed', 'Learner confirmed presence', `"${s.subject||'Session'}" timer has started.`, { session_id:sessionId });
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false, message: 'Server error' }); }
});

app.post('/reject-session-request', (req, res) => {
  const { sessionId } = req.body;
  try {
    const s = query('SELECT * FROM sessions WHERE id=?', [sessionId]);
    query("UPDATE sessions SET status='rejected',updated_at=datetime('now','localtime') WHERE id=?", [sessionId]);
    if (s.length) createNotification(s[0].learner_email, 'session_rejected', 'Session declined', `"${s[0].subject||'Session'}" was declined.`, {});
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

app.post('/get-active-session', (req, res) => {
  const { email } = req.body;
  try {
    const sess = query(
      `SELECT s.*,CASE WHEN s.learner_email=? THEN 'learner' ELSE 'tutor' END as user_role,
              u1.name as learner_name,u1.username as learner_username,u1.profile_pic as learner_profile_pic,
              u2.name as tutor_name,u2.username as tutor_username,u2.profile_pic as tutor_profile_pic
       FROM sessions s JOIN users u1 ON s.learner_email=u1.email JOIN users u2 ON s.tutor_email=u2.email
       WHERE (s.learner_email=? OR s.tutor_email=?) AND s.status IN ('pending','active','confirmed','scheduled','rescheduling')
       ORDER BY s.created_at DESC LIMIT 1`,
      [email,email,email]);
    res.json({ success: true, session: sess.length ? sess[0] : null });
  } catch(e) { res.json({ success: false, session: null }); }
});

app.post('/get-pending-session-requests', (req, res) => {
  const { tutorEmail } = req.body;
  try {
    res.json({ success: true, sessions: query(
      `SELECT s.*,u.name as learner_name,u.username as learner_username,u.profile_pic as learner_profile_pic,u.grade_level as learner_grade
       FROM sessions s JOIN users u ON s.learner_email=u.email
       WHERE s.tutor_email=? AND s.status='pending' ORDER BY s.created_at DESC`,
      [tutorEmail]) });
  } catch(e) { res.json({ success: false, sessions: [] }); }
});

// ─── CREDIT RATIO: elapsed seconds → tutor gets this fraction of 1 credit ───
// 0 sec     → 0    (full refund)
// 1–59 sec  → 0.05
// 1–5 min   → 0.10
// 5–10 min  → 0.25
// 10–20 min → 0.50
// 20+ min   → 1.00
function calcCreditAward(sec) {
  if (sec <= 0)    return 0;
  if (sec < 60)    return 0.05;
  if (sec < 300)   return 0.10;
  if (sec < 600)   return 0.25;
  if (sec < 1200)  return 0.50;
  return 1;
}

app.post('/complete-session', (req, res) => {
  const { sessionId, rating, feedback, elapsedSeconds, feedbackTags } = req.body;
  try {
    const s = query('SELECT * FROM sessions WHERE id=?', [sessionId]);
    if (!s.length) return res.json({ success: false, message: 'Not found' });
    const sess = s[0];
    const elapsed = elapsedSeconds || 0;

    const creditAward     = calcCreditAward(elapsed);
    const refundToLearner = parseFloat((1 - creditAward).toFixed(2));

    if (elapsed === 0 || creditAward === 0) {
      // Full refund
      const lr = query('SELECT credits FROM users WHERE email=?', [sess.learner_email]);
      if (lr.length) {
        const nc = parseFloat(((lr[0].credits||0) + 1).toFixed(2));
        query('UPDATE users SET credits=? WHERE email=?', [nc, sess.learner_email]);
        query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,1,'full_refund',?,datetime('now','localtime'))`,
          [sess.tutor_email, sess.learner_email, sessionId]);
        createNotification(sess.learner_email, 'credit_gain', 'Full credit refund', 'Session ended before it started.', { session_id:sessionId, amount:1 });
        emitCreditUpdate(sess.learner_email, nc);
      }
    } else {
      // Award tutor
      const tr = query('SELECT credits FROM users WHERE email=?', [sess.tutor_email]);
      if (tr.length && creditAward > 0) {
        const nc = parseFloat(((tr[0].credits||0) + creditAward).toFixed(2));
        query('UPDATE users SET credits=? WHERE email=?', [nc, sess.tutor_email]);
        query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,?,'session_payment',?,datetime('now','localtime'))`,
          [sess.learner_email, sess.tutor_email, creditAward, sessionId]);
        createNotification(sess.tutor_email, 'credit_gain', `${creditAward} credit(s) earned`, `For "${sess.subject||'Session'}" (${Math.floor(elapsed/60)} min).`, { session_id:sessionId, amount:creditAward });
        emitCreditUpdate(sess.tutor_email, nc);
      }
      // Partial refund
      if (refundToLearner > 0) {
        const lr = query('SELECT credits FROM users WHERE email=?', [sess.learner_email]);
        if (lr.length) {
          const nc = parseFloat(((lr[0].credits||0) + refundToLearner).toFixed(2));
          query('UPDATE users SET credits=? WHERE email=?', [nc, sess.learner_email]);
          query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,?,'partial_refund',?,datetime('now','localtime'))`,
            [sess.tutor_email, sess.learner_email, refundToLearner, sessionId]);
          createNotification(sess.learner_email, 'credit_gain', `${refundToLearner} credit(s) refunded`, `Session ended after ${Math.floor(elapsed/60)} min.`, { session_id:sessionId, amount:refundToLearner });
          emitCreditUpdate(sess.learner_email, nc);
        }
      }
    }

    query(`UPDATE sessions SET status='completed',rating=?,feedback=?,session_end=datetime('now','localtime'),elapsed_seconds=? WHERE id=?`,
      [rating||null, feedback||null, elapsed, sessionId]);

    // Store structured feedback
    if (feedback || (feedbackTags && feedbackTags.length)) {
      const positiveTags = ['clear explanation','patient','knowledgeable','engaging','helpful','punctual','improved_skills'];
      const tags         = feedbackTags || [];
      const posCount     = tags.filter(t=>positiveTags.some(p=>t.toLowerCase().includes(p))).length;
      const sentiment    = posCount >= Math.max(tags.length/2,1) ? 'positive' : 'neutral';
      try {
        query(`INSERT INTO session_feedback (session_id,tutor_email,learner_email,rating,comment,feedback_tags,sentiment,created_at) VALUES (?,?,?,?,?,?,?,datetime('now','localtime'))`,
          [sessionId, sess.tutor_email, sess.learner_email, rating||null, feedback||'', JSON.stringify(tags), sentiment]);
      } catch(e) {}
    }

    // Update tutor average rating — used in matching score
    if (rating) {
      const avg = query('SELECT AVG(rating) as a FROM sessions WHERE tutor_email=? AND rating IS NOT NULL', [sess.tutor_email]);
      if (avg[0]?.a) query('UPDATE users SET rating=? WHERE email=?', [parseFloat(avg[0].a.toFixed(2)), sess.tutor_email]);
    }

    // Emit rating-completed to all clients so match scores can refresh
    io.to(`user:${sess.learner_email}`).emit('session-rated', { sessionId, tutorEmail: sess.tutor_email });
    io.to(`user:${sess.tutor_email}`).emit('session-rated', { sessionId });

    if (feedback?.trim()) checkAndAwardQuest(sess.learner_email, 'give_feedback');
    checkAndAwardQuest(sess.learner_email, 'session_complete', { session: sess });
    checkAndAwardQuest(sess.tutor_email, 'tutor_session_complete', { session: { ...sess, rating } });
    checkWeeklyStreak(sess.learner_email);
    checkWeeklyStreak(sess.tutor_email);

    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: false }); }
});

app.post('/extend-session', (req, res) => {
  const { sessionId, learnerEmail } = req.body;
  try {
    const s = query("SELECT * FROM sessions WHERE id=? AND learner_email=? AND status='active'", [sessionId,learnerEmail]);
    if (!s.length) return res.json({ success: false, message: 'No active session found.' });
    const sess = s[0];
    const lr = query('SELECT credits FROM users WHERE email=?', [learnerEmail]);
    if (!lr.length || lr[0].credits < 1) return res.json({ success: false, message: 'Insufficient credits.' });
    const nc = parseFloat((lr[0].credits - 1).toFixed(2));
    query('UPDATE users SET credits=? WHERE email=?', [nc, learnerEmail]);
    query(`INSERT INTO transactions (from_email,to_email,amount,type,session_id,created_at) VALUES (?,?,1,'session_extension',?,datetime('now','localtime'))`,
      [learnerEmail, sess.tutor_email, sessionId]);
    query('UPDATE sessions SET extension_count=COALESCE(extension_count,0)+1 WHERE id=?', [sessionId]);
    createNotification(learnerEmail, 'credit_loss', '1 credit for extension', `Extended "${sess.subject||'Session'}".`, { session_id:sessionId, amount:-1 });
    createNotification(sess.tutor_email, 'session_extended', 'Session extended', `Learner added 30 min to "${sess.subject||'Session'}".`, { session_id:sessionId });
    emitCreditUpdate(learnerEmail, nc);
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

// ─── LEDGER ───────────────────────────────────────────────────
app.post('/get-ledger', (req, res) => {
  const { email } = req.body;
  try {
    res.json({ success: true, transactions: query(
      `SELECT t.*, COALESCE(u1.username,u1.name,'system') as from_name, COALESCE(u2.username,u2.name,'system') as to_name
       FROM transactions t LEFT JOIN users u1 ON t.from_email=u1.email LEFT JOIN users u2 ON t.to_email=u2.email
       WHERE t.from_email=? OR t.to_email=? ORDER BY t.created_at DESC`,
      [email,email]) });
  } catch(e) { res.json({ success: false, transactions: [] }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────
app.post('/get-notifications', (req, res) => {
  const { email } = req.body;
  try { res.json({ success: true, notifications: query('SELECT * FROM notifications WHERE recipient_email=? ORDER BY created_at DESC LIMIT 60', [email]) }); }
  catch(e) { res.json({ success: false, notifications: [] }); }
});
app.post('/mark-notifications-read', (req, res) => {
  const { email } = req.body;
  try { query('UPDATE notifications SET is_read=1 WHERE recipient_email=?', [email]); res.json({ success: true }); }
  catch(e) { res.json({ success: false }); }
});
app.post('/mark-notification-read', (req, res) => {
  const { email, notifId } = req.body;
  try { query('UPDATE notifications SET is_read=1 WHERE id=? AND recipient_email=?', [notifId,email]); res.json({ success: true }); }
  catch(e) { res.json({ success: false }); }
});

// ─── CALENDAR ─────────────────────────────────────────────────
app.post('/get-calendar-sessions', (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, sessions: [] });
  try {
    const sessions = query(
      `SELECT s.*,CASE WHEN s.learner_email=? THEN 'learner' ELSE 'tutor' END as user_role,
              u1.name as learner_name,u1.username as learner_username,
              u2.name as tutor_name,u2.username as tutor_username,
              (SELECT COUNT(*)+1 FROM group_session_members gsm WHERE gsm.session_id=s.id) as attendee_count
       FROM sessions s JOIN users u1 ON s.learner_email=u1.email JOIN users u2 ON s.tutor_email=u2.email
       WHERE (s.learner_email=? OR s.tutor_email=?) AND s.status IN ('confirmed','active','completed','scheduled','rescheduling')
       ORDER BY COALESCE(s.scheduled_time,s.session_start,s.created_at) DESC`,
      [email,email,email]);
    res.json({ success: true, sessions });
  } catch(e) { console.error(e); res.json({ success: false, sessions: [] }); }
});

// ─── QUESTS — rebalanced credits ──────────────────────────────
// Balancing principle: credits should feel meaningful but not trivial.
// Profile/first connection: 0.25 (small welcome bonus)
// First session: 1.0 (milestone)
// 5 sessions: 2.0, 10 sessions: 4.0 (major milestones)
// Weekly streak: 2.0 (effort-based)
// Feedback: 0.1 per submit (encourage quality ratings)
// Perfect rating: 0.5 (skill recognition)
// Dedicated mentor 10 sessions: 5.0 (major achievement)
const QUESTS = [
  { id:'profile_complete',    title:'Profile Complete',      desc:'Complete your profile',                     credits:0.25, once:true,  icon:'✅' },
  { id:'first_connection',    title:'First Connection',      desc:'Connect with your first mentor or learner', credits:0.25, once:true,  icon:'🤝' },
  { id:'first_session',       title:'First Session',         desc:'Complete your first session',               credits:1,    once:true,  icon:'🎓' },
  { id:'tutor_first_session', title:'First Mentoring',       desc:'Complete your first session as a mentor',   credits:1,    once:true,  icon:'🏅' },
  { id:'session_5',           title:'5 Sessions',            desc:'Complete 5 sessions as a learner',          credits:2,    once:true,  icon:'🔥' },
  { id:'session_10',          title:'10 Sessions',           desc:'Complete 10 sessions as a learner',         credits:4,    once:true,  icon:'⭐' },
  { id:'weekly_streak',       title:'Weekly Learner',        desc:'Join sessions 7 days in a row',             credits:2,    once:false, icon:'📅', refreshDays:7 },
  { id:'group_session_5',     title:'Group Regular',         desc:'Join 5 group sessions',                     credits:0.5,  once:false, icon:'👥' },
  { id:'perfect_rating',      title:'Perfect Rating',        desc:'Receive a 5-star rating as a mentor',       credits:0.5,  once:false, icon:'⭐' },
  { id:'login_streak_7',      title:'Consistent Learner',    desc:'Log in 7 days in a row',                   credits:1,    once:true,  icon:'🌟' },
  { id:'give_feedback',       title:'Helpful Reviewer',      desc:'Leave feedback after a session',            credits:0.1,  once:false, icon:'💬' },
  { id:'tutor_10_sessions',   title:'Dedicated Mentor',      desc:'Complete 10 sessions as a mentor',          credits:5,    once:true,  icon:'🏆' },
  { id:'early_bird',          title:'Early Bird',            desc:'Complete a session before 9 AM',            credits:0.25, once:false, icon:'🌅', refreshDays:7 },
  { id:'night_owl',           title:'Night Owl',             desc:'Complete a session after 9 PM',             credits:0.25, once:false, icon:'🌙', refreshDays:7 },
  { id:'multi_subject',       title:'Well-Rounded',          desc:'Get sessions in 3 different subjects',      credits:1,    once:true,  icon:'📚' },
];

// ─── REPLACE the existing /get-quests route with this version ─
// Changes: completed quests sorted to bottom; repeatable quests show cooldown status

app.get('/get-quests', (req, res) => {
    const { email } = req.query;
    if (!email) return res.json({ success: false, quests: [] });
    try {
        const completed = query('SELECT quest_id, completed_at FROM user_quests WHERE email=?', [email]);
        const completedMap = {};
        completed.forEach(q => { completedMap[q.quest_id] = q.completed_at; });

        const result = QUESTS.map(q => {
            const doneAt = completedMap[q.id];
            const done   = !!doneAt;
            return { ...q, completed: done, completed_at: doneAt || null };
        });

        // Sort: incomplete first, completed last
        result.sort((a, b) => {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });

        res.json({ success: true, quests: result });
    } catch(e) { res.json({ success: false, quests: [] }); }
});

function checkAndAwardQuest(email, questId, context = {}) {
  try {
    const q = QUESTS.find(x => x.id === questId);
    if (!q) return;

    // For repeatable quests with refresh, check cooldown
    if (!q.once && q.refreshDays) {
      const done = query('SELECT completed_at FROM user_quests WHERE email=? AND quest_id=? ORDER BY completed_at DESC LIMIT 1', [email, questId]);
      if (done.length) {
        const daysSince = (Date.now() - new Date(done[0].completed_at)) / (1000 * 60 * 60 * 24);
        if (daysSince < q.refreshDays) return; // still in cooldown
      }
    } else if (q.once) {
      const done = query('SELECT id FROM user_quests WHERE email=? AND quest_id=?', [email, questId]);
      if (done.length) return;
    }

    let shouldAward = false;
    if (questId === 'profile_complete')   shouldAward = true;
    if (questId === 'first_connection')   shouldAward = true;
    if (questId === 'first_session') {
      const cnt = query("SELECT COUNT(*) as c FROM sessions WHERE learner_email=? AND status='completed'", [email]);
      shouldAward = (cnt[0]?.c||0) >= 1;
    }
    if (questId === 'tutor_first_session') {
      const cnt = query("SELECT COUNT(*) as c FROM sessions WHERE tutor_email=? AND status='completed'", [email]);
      shouldAward = (cnt[0]?.c||0) >= 1;
    }
    if (questId === 'session_5') {
      const cnt = query("SELECT COUNT(*) as c FROM sessions WHERE learner_email=? AND status='completed'", [email]);
      shouldAward = (cnt[0]?.c||0) >= 5;
    }
    if (questId === 'session_10') {
      const cnt = query("SELECT COUNT(*) as c FROM sessions WHERE learner_email=? AND status='completed'", [email]);
      shouldAward = (cnt[0]?.c||0) >= 10;
    }
    if (questId === 'tutor_10_sessions') {
      const cnt = query("SELECT COUNT(*) as c FROM sessions WHERE tutor_email=? AND status='completed'", [email]);
      shouldAward = (cnt[0]?.c||0) >= 10;
    }
    if (questId === 'session_complete') {
      checkAndAwardQuest(email, 'first_session');
      checkAndAwardQuest(email, 'session_5');
      checkAndAwardQuest(email, 'session_10');
      checkGroupSessionQuest(email);
      checkMultiSubjectQuest(email);
      checkTimeBasedQuests(email, context.session);
      return;
    }
    if (questId === 'tutor_session_complete') {
      checkAndAwardQuest(email, 'tutor_first_session');
      checkAndAwardQuest(email, 'tutor_10_sessions');
      if (context.session?.rating === 5) checkAndAwardQuest(email, 'perfect_rating');
      return;
    }
    if (questId === 'perfect_rating')   shouldAward = true;
    if (questId === 'give_feedback')    shouldAward = true;
    if (questId === 'early_bird')       shouldAward = true;
    if (questId === 'night_owl')        shouldAward = true;
    if (questId === 'login_streak_7')   shouldAward = true;
    if (questId === 'weekly_streak')    shouldAward = true;
    if (questId === 'multi_subject')    shouldAward = true;

    if (shouldAward) {
      // For repeatable quests, delete old record so we can re-insert with new timestamp
      if (!q.once) query('DELETE FROM user_quests WHERE email=? AND quest_id=?', [email, questId]);
      query("INSERT OR IGNORE INTO user_quests (email,quest_id,completed_at) VALUES (?,?,datetime('now','localtime'))", [email, questId]);
      awardCredits(email, q.credits, 'quest_reward', q.desc, { quest_id: questId });
      createNotification(email, 'quest_complete', `Quest Complete: ${q.title}`, `You earned ${q.credits} credit(s)! ${q.desc}`, { quest_id:questId, credits:q.credits });
    }
  } catch(e) { console.error('Quest error:', e); }
}

function checkGroupSessionQuest(email) {
  try {
    const cnt = query(`SELECT COUNT(*) as c FROM group_session_members WHERE learner_email=?`, [email]);
    const total = cnt[0]?.c || 0;
    if (total > 0 && total % 5 === 0) {
      awardCredits(email, 0.5, 'quest_reward', 'Joined 5 group sessions', { quest_id:'group_session_5' });
      createNotification(email, 'quest_complete', 'Quest: Group Regular', 'Joined 5 group sessions! +0.5 credits', { quest_id:'group_session_5' });
    }
  } catch(e) {}
}
function checkMultiSubjectQuest(email) {
  try {
    const done = query("SELECT id FROM user_quests WHERE email=? AND quest_id='multi_subject'", [email]);
    if (done.length) return;
    const subjects = query("SELECT DISTINCT subject FROM sessions WHERE learner_email=? AND status='completed' AND subject!=''", [email]);
    if (subjects.length >= 3) checkAndAwardQuest(email, 'multi_subject');
  } catch(e) {}
}
function checkTimeBasedQuests(email, session) {
  if (!session?.session_start) return;
  try {
    const hour = new Date(session.session_start).getHours();
    if (hour < 9)  checkAndAwardQuest(email, 'early_bird');
    if (hour >= 21) checkAndAwardQuest(email, 'night_owl');
  } catch(e) {}
}
function checkWeeklyStreak(email) {
  try {
    const rows = query(
      `SELECT DISTINCT date(session_end,'localtime') as d FROM sessions
       WHERE (learner_email=? OR tutor_email=?) AND status='completed' AND session_end>=datetime('now','-8 days','localtime')`,
      [email,email]);
    if (rows.length >= 7) checkAndAwardQuest(email, 'weekly_streak');
  } catch(e) {}
}
function checkLoginStreak(email) {
  try {
    query(`INSERT OR IGNORE INTO login_streak (email,login_date) VALUES (?,date('now','localtime'))`, [email]);
    const rows = query(`SELECT login_date FROM login_streak WHERE email=? ORDER BY login_date DESC LIMIT 7`, [email]);
    if (rows.length >= 7) {
      let consecutive = true;
      for (let i = 0; i < rows.length - 1; i++) {
        const a = new Date(rows[i].login_date);
        const b = new Date(rows[i+1].login_date);
        if ((a-b)/(1000*60*60*24) !== 1) { consecutive = false; break; }
      }
      if (consecutive) checkAndAwardQuest(email, 'login_streak_7');
    }
  } catch(e) {}
}

// ─── AI STUDY RECOMMENDATIONS — smarter version ───────────────
app.post('/get-study-recommendations', async (req, res) => {
  const { email } = req.body;
  try {
    const user = query('SELECT skills,growth,grade_level,rating FROM users WHERE email=?', [email]);
    if (!user.length) return res.json({ success: false, recommendations: [] });
    const u = user[0];
    let growth = [], skills = [];
    try { growth = JSON.parse(u.growth||'[]'); skills = JSON.parse(u.skills||'[]'); } catch(e) {}

    const completedSessions = query(
      `SELECT subject, AVG(rating) as avg_rating, COUNT(*) as cnt,
              MAX(session_end) as last_session
       FROM sessions WHERE learner_email=? AND status='completed' GROUP BY subject ORDER BY cnt DESC`,
      [email]);
    const sessionsAsLearner = query("SELECT COUNT(*) as c FROM sessions WHERE learner_email=? AND status='completed'", [email])[0]?.c || 0;
    const weakSubjects   = completedSessions.filter(s=>(s.avg_rating||5)<3.5).map(s=>s.subject);
    const strongSubjects = completedSessions.filter(s=>(s.avg_rating||0)>=4).map(s=>s.subject);
    const studiedSubjects = completedSessions.map(s=>s.subject?.toLowerCase()).filter(Boolean);
    const unstudied      = growth.filter(g=>!studiedSubjects.includes(g.toLowerCase()));

    // Subjects not practiced recently (>14 days)
    const staleSubjects = completedSessions.filter(s => {
      if (!s.last_session) return false;
      const daysSince = (Date.now() - new Date(s.last_session)) / (1000*60*60*24);
      return daysSince > 14 && s.cnt >= 2;
    }).map(s => s.subject);

    const recs = [];

    // High priority: unstarted learning goals
    unstudied.slice(0,2).forEach(subj => recs.push({
      type:'start_learning', subject:subj, title:`Start: ${subj}`,
      reason:`This is in your learning goals but you have not had a session yet. Finding a mentor is the fastest way to get started.`,
      priority:'high', icon:'🎯'
    }));

    // Medium priority: subjects needing improvement
    weakSubjects.slice(0,2).forEach(subj => recs.push({
      type:'revisit', subject:subj, title:`Revisit ${subj}`,
      reason:`Your sessions in ${subj} received below-average ratings. More practice with a mentor would help.`,
      priority:'medium', icon:'🔄'
    }));

    // Stale subjects: haven't practiced in a while
    staleSubjects.slice(0,1).forEach(subj => recs.push({
      type:'refresh', subject:subj, title:`Refresh ${subj}`,
      reason:`It has been over two weeks since your last ${subj} session. Regular practice helps retain knowledge.`,
      priority:'medium', icon:'📖'
    }));

    // Build progression map for advancement suggestions
    const adjacentMap = {
      'Algebra':['Calculus','Statistics','Linear Algebra'],
      'Python':['Data Science','Machine Learning','Algorithms'],
      'Biology':['Biochemistry','Anatomy','Genetics'],
      'Economics':['Finance','Statistics','Business Law'],
      'English':['Creative Writing','Debate','Journalism'],
      'Physics':['Calculus','Astronomy'],
      'Chemistry':['Organic Chemistry','Biochemistry','Physics'],
      'Programming':['Data Structures','Algorithms','Web Development'],
      'Statistics':['Machine Learning','Data Science','Probability'],
      'Calculus':['Linear Algebra','Physics','Statistics'],
      'Web Development':['App Development','JavaScript','SQL'],
    };
    strongSubjects.forEach(subj => {
      const adj = (adjacentMap[subj]||[]).filter(a=>!studiedSubjects.includes(a.toLowerCase())).slice(0,1);
      adj.forEach(a => recs.push({
        type:'next_step', subject:a, title:`Level up to ${a}`,
        reason:`You are performing well in ${subj}. ${a} is the natural next subject to expand your expertise.`,
        priority:'low', icon:'⬆️'
      }));
    });

    // Quest nudges
    if (sessionsAsLearner === 0) recs.push({
      type:'get_started', subject:growth[0]||'your first subject', title:'Book your first session',
      reason:`You have not had a session yet. Find a mentor for ${growth[0]||'any subject'} to begin earning credits and completing quests.`,
      priority:'high', icon:'🚀'
    });
    if (sessionsAsLearner > 0 && sessionsAsLearner < 5) recs.push({
      type:'streak', subject:null, title:`${5-sessionsAsLearner} more sessions for the 5 Sessions quest`,
      reason:`Complete 5 total sessions to earn 2 bonus credits. You are ${sessionsAsLearner} sessions in.`,
      priority:'low', icon:'🏆'
    });

    res.json({ success: true, recommendations: recs.slice(0,6) });
  } catch(e) { console.error(e); res.json({ success: false, recommendations: [] }); }
});

// ─── SESSION FEEDBACK ─────────────────────────────────────────
app.post('/get-mentor-feedback', (req, res) => {
  const { tutorEmail } = req.body;
  try {
    const feedback = query(
      `SELECT sf.rating,sf.comment,sf.feedback_tags,sf.sentiment,sf.created_at,u.username,u.name
       FROM session_feedback sf JOIN users u ON sf.learner_email=u.email
       WHERE sf.tutor_email=? ORDER BY sf.created_at DESC LIMIT 10`,
      [tutorEmail]);
    res.json({ success: true, feedback });
  } catch(e) { res.json({ success: false, feedback: [] }); }
});

// ─── DEBUG ────────────────────────────────────────────────────
app.get('/debug-notifications', (req, res) => {
  try {
    const all    = query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
    const tables = query("SELECT name FROM sqlite_master WHERE type='table'");
    res.json({ tables: tables.map(t=>t.name), notifications: all });
  } catch(err) { res.json({ error: err.message }); }
});

// ─── WebRTC SIGNALING ─────────────────────────────────────────
const videoRooms = {};
io.on('connection', (socket) => {
  socket.on('register-user', ({ email }) => { if (email) socket.join(`user:${email}`); });
  socket.on('join-video-room', ({ roomId, email }) => {
    socket.join(roomId);
    if (!videoRooms[roomId]) videoRooms[roomId] = {};
    videoRooms[roomId][socket.id] = email;
    const others = Object.entries(videoRooms[roomId]).filter(([id])=>id!==socket.id).map(([id,em])=>({ socketId:id, email:em }));
    socket.emit('room-users', others);
    socket.to(roomId).emit('user-joined', { socketId:socket.id, email });
  });
  socket.on('offer',         ({ to, offer })     => io.to(to).emit('offer',         { from:socket.id, offer }));
  socket.on('answer',        ({ to, answer })    => io.to(to).emit('answer',        { from:socket.id, answer }));
  socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from:socket.id, candidate }));
  socket.on('end-call', ({ roomId }) => {
    socket.to(roomId).emit('call-ended');
    socket.leave(roomId);
    if (videoRooms[roomId]) delete videoRooms[roomId][socket.id];
  });
  socket.on('disconnect', () => {
    for (const rid in videoRooms) {
      if (videoRooms[rid][socket.id]) {
        delete videoRooms[rid][socket.id];
        socket.to(rid).emit('user-left', { socketId:socket.id });
        if (!Object.keys(videoRooms[rid]).length) delete videoRooms[rid];
      }
    }
  });
});

// ─── INIT DB ──────────────────────────────────────────────────
function initDatabase() {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      password TEXT NOT NULL, username TEXT, bio TEXT, achievements TEXT, skills TEXT, growth TEXT,
      credits REAL DEFAULT 5, rating REAL DEFAULT 0, profile_pic TEXT, grade_level TEXT,
      profile_completed INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS connection_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, learner_email TEXT NOT NULL, tutor_email TEXT NOT NULL,
      subject TEXT, message TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user1_email TEXT NOT NULL, user2_email TEXT NOT NULL,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user1_email,user2_email)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sender_email TEXT NOT NULL, receiver_email TEXT NOT NULL,
      message TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, from_email TEXT NOT NULL, to_email TEXT NOT NULL,
      amount REAL NOT NULL, type TEXT DEFAULT 'session_payment', session_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, learner_email TEXT NOT NULL, tutor_email TEXT NOT NULL,
      subject TEXT, session_notes TEXT, session_type TEXT DEFAULT 'solo', session_mode TEXT DEFAULT 'online',
      preferred_time DATETIME, status TEXT DEFAULT 'pending', rating INTEGER, feedback TEXT,
      session_start DATETIME, session_end DATETIME, scheduled_time DATETIME,
      elapsed_seconds INTEGER DEFAULT 0, extension_count INTEGER DEFAULT 0, learner_confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS group_session_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, learner_email TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id,learner_email)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_email TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT, body TEXT, data TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS session_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, tutor_email TEXT NOT NULL,
      learner_email TEXT NOT NULL, rating INTEGER, comment TEXT, feedback_tags TEXT, sentiment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, quest_id TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(email, quest_id)
    );
    CREATE TABLE IF NOT EXISTS login_streak (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, login_date TEXT NOT NULL, UNIQUE(email,login_date)
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe column migrations
  const sa = (sql) => { try { db.prepare(sql).run(); } catch(e) {} };
  sa("ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'solo'");
  sa("ALTER TABLE sessions ADD COLUMN session_mode TEXT DEFAULT 'online'");
  sa('ALTER TABLE sessions ADD COLUMN preferred_time DATETIME');
  sa('ALTER TABLE sessions ADD COLUMN elapsed_seconds INTEGER DEFAULT 0');
  sa('ALTER TABLE sessions ADD COLUMN extension_count INTEGER DEFAULT 0');
  sa('ALTER TABLE sessions ADD COLUMN learner_confirmed_at DATETIME');
  // Allow repeatable quests to have multiple rows
  try { db.prepare("DROP INDEX IF EXISTS sqlite_autoindex_user_quests_1").run(); } catch(e) {}
  // Re-create user_quests without unique constraint on quest_id for repeatable quests
  // (The app logic handles cooldowns — the UNIQUE constraint is only on id)

  try { db.prepare("INSERT OR IGNORE INTO users (email,name,password,credits) VALUES ('system','Tandem System','!',0)").run(); } catch(e) {}

  console.log('✅ Database ready');
  logStats();
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initDatabase();
});

