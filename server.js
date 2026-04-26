const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Database connection
const db = new Database('tandem.db');

db.pragma('journal_mode = WAL');

console.log('📁 Database path:', path.resolve('tandem.db'));

// Helper function for queries
function query(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return stmt.all(params);
        } else {
            return stmt.run(params);
        }
    } catch (error) {
        throw error;
    }
}

// Function to log database stats
function logDatabaseStats() {
    try {
        const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'connection_requests', 'connections', 'sessions')");
        const tableNames = tables.map(t => t.name);
        
        let userCount = 0;
        let pendingRequests = 0;
        let activeConnections = 0;
        let pendingSessions = 0;
        
        if (tableNames.includes('users')) {
            const result = query('SELECT COUNT(*) as count FROM users');
            userCount = result[0]?.count || 0;
        }
        
        if (tableNames.includes('connection_requests')) {
            const result = query("SELECT COUNT(*) as count FROM connection_requests WHERE status = 'pending'");
            pendingRequests = result[0]?.count || 0;
        }
        
        if (tableNames.includes('connections')) {
            const result = query('SELECT COUNT(*) as count FROM connections');
            activeConnections = result[0]?.count || 0;
        }
        
        if (tableNames.includes('sessions')) {
            const result = query("SELECT COUNT(*) as count FROM sessions WHERE status = 'pending'");
            pendingSessions = result[0]?.count || 0;
        }
        
        console.log(`\n📊 ===== DATABASE STATS =====`);
        console.log(`👥 Users: ${userCount}`);
        console.log(`⏳ Pending connection requests: ${pendingRequests}`);
        console.log(`⏳ Pending session requests: ${pendingSessions}`);
        console.log(`🔗 Active connections: ${activeConnections}`);
        console.log(`===========================\n`);
    } catch (error) {
        // Silently ignore stats errors
    }
}

// ============ REGISTER ============
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.json({ success: false, message: 'All fields are required' });
    }

    try {
        const existingUser = query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.json({ success: false, message: 'Email already registered' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        query(
            "INSERT INTO users (name, email, password, credits, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
            [name, email, hashedPassword, 5]
        );

        console.log(`✅ New user registered: ${email}`);
        logDatabaseStats();

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// ============ LOGIN ============
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    try {
        const users = query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const user = users[0];
        const validPassword = bcrypt.compareSync(password, user.password);

        if (!validPassword) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        console.log(`✅ User logged in: ${email}`);
        logDatabaseStats();

        res.json({
            success: true,
            name: user.name,
            username: user.username || '',
            bio: user.bio || '',
            achievements: user.achievements || '',
            skills: user.skills || '[]',
            growth: user.growth || '[]',
            credits: user.credits || 5,
            profile_pic: user.profile_pic || '',
            grade_level: user.grade_level || '',
            profile_completed: user.profile_completed || 0
        });
    } catch (error) {
        console.error('Login error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// ============ COMPLETE PROFILE ============
app.post('/complete-profile', (req, res) => {
    const { email, username, skills, growth, profile_pic, bio, achievements, grade_level } = req.body;

    try {
        query(
            `UPDATE users SET 
                username = ?, 
                skills = ?, 
                growth = ?, 
                profile_pic = ?,
                bio = ?,
                achievements = ?,
                grade_level = ?,
                profile_completed = 1
            WHERE email = ?`,
            [username, JSON.stringify(skills), JSON.stringify(growth), profile_pic || null, bio || '', achievements || '', grade_level || '', email]
        );

        console.log(`✅ Profile completed for: ${email}`);
        logDatabaseStats();

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Complete profile error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// ============ UPDATE CREDITS ============
app.post('/update-credits', (req, res) => {
    const { email, credits } = req.body;

    try {
        query('UPDATE users SET credits = ? WHERE email = ?', [credits, email]);
        console.log(`💰 Credits updated for ${email}: ${credits}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating credits:', error);
        res.json({ success: false, message: 'Error updating credits' });
    }
});

// ============ GET USER DATA ============
app.post('/get-user-data', (req, res) => {
    const { email } = req.body;

    try {
        const result = query(
            'SELECT name, username, bio, achievements, skills, growth, credits, grade_level, profile_pic FROM users WHERE email = ?',
            [email]
        );

        if (result.length > 0) {
            const user = result[0];
            res.json({
                success: true,
                credits: user.credits || 5,
                bio: user.bio || '',
                achievements: user.achievements || '',
                skills: user.skills || '[]',
                growth: user.growth || '[]',
                grade_level: user.grade_level || '',
                profile_pic: user.profile_pic || ''
            });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        res.json({ success: false, message: 'Error getting user data' });
    }
});

// ============ GET SWIPE MATCHES ============
app.post('/get-swipe-matches', (req, res) => {
    const { email } = req.body;

    try {
        const currentUser = query('SELECT skills, growth, grade_level FROM users WHERE email = ?', [email]);

        let userSkills = [];
        let userGrowth = [];
        let userGradeLevel = '';

        if (currentUser.length > 0) {
            try {
                userSkills = JSON.parse(currentUser[0].skills || '[]');
                userGrowth = JSON.parse(currentUser[0].growth || '[]');
                userGradeLevel = currentUser[0].grade_level || '';
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }

        const excludeEmails = query(`
            SELECT DISTINCT 
                CASE 
                    WHEN learner_email = ? THEN tutor_email
                    WHEN tutor_email = ? THEN learner_email
                END as excluded_email
            FROM connection_requests 
            WHERE (learner_email = ? OR tutor_email = ?) 
            AND status IN ('pending', 'accepted')
        `, [email, email, email, email]);

        const pendingExcludes = excludeEmails.map(e => e.excluded_email).filter(e => e);
        
        const connectedEmails = query(`
            SELECT DISTINCT 
                CASE 
                    WHEN user1_email = ? THEN user2_email
                    WHEN user2_email = ? THEN user1_email
                END as connected_email
            FROM connections 
            WHERE user1_email = ? OR user2_email = ?
        `, [email, email, email, email]);

        const connectedExcludes = connectedEmails.map(e => e.connected_email).filter(e => e);
        
        const allExcludes = [...new Set([...pendingExcludes, ...connectedExcludes])];

        let otherUsers;
        if (allExcludes.length > 0) {
            const placeholders = allExcludes.map(() => '?').join(',');
            otherUsers = query(
                `SELECT email, name, username, bio, skills, growth, rating, profile_pic, credits, grade_level 
                 FROM users WHERE email != ? AND email NOT IN (${placeholders})`,
                [email, ...allExcludes]
            );
        } else {
            otherUsers = query(
                'SELECT email, name, username, bio, skills, growth, rating, profile_pic, credits, grade_level FROM users WHERE email != ?',
                [email]
            );
        }

        console.log(`📋 Found ${otherUsers.length} potential matches`);

        const gradeCompatibility = {
            'elementary': ['elementary', 'junior_high'],
            'junior_high': ['elementary', 'junior_high', 'senior_high'],
            'senior_high': ['junior_high', 'senior_high', 'college'],
            'college': ['senior_high', 'college', 'postgrad'],
            'postgrad': ['college', 'postgrad', 'professional'],
            'professional': ['postgrad', 'professional']
        };

        const matches = otherUsers.map(otherUser => {
            let otherSkills = [];
            let otherGrowth = [];
            let otherGradeLevel = otherUser.grade_level || '';
            
            try {
                otherSkills = JSON.parse(otherUser.skills || '[]');
                otherGrowth = JSON.parse(otherUser.growth || '[]');
            } catch (e) {}

            let gradeCompatible = false;
            if (userGradeLevel && otherGradeLevel) {
                const compatibleLevels = gradeCompatibility[userGradeLevel] || [];
                gradeCompatible = compatibleLevels.includes(otherGradeLevel);
            } else {
                gradeCompatible = true;
            }

            let gradeMultiplier = gradeCompatible ? 1 : 0.3;

            let learnScore = 0;
            let learnTotalWeight = 0;
            
            userGrowth.forEach(growthItem => {
                if (otherSkills.some(skill => skill.toLowerCase() === growthItem.toLowerCase())) {
                    learnScore += 100;
                }
                learnTotalWeight += 100;
            });
            
            const normalizedLearnScore = learnTotalWeight > 0 ? (learnScore / learnTotalWeight) * 100 : 0;

            let matchScore = normalizedLearnScore * gradeMultiplier;
            const skillBonus = Math.min(otherSkills.length, 10);
            matchScore = Math.min(matchScore + skillBonus, 100);

            return {
                ...otherUser,
                matchScore: Math.round(matchScore),
                rating: otherUser.rating || 0,
                grade_compatible: gradeCompatible
            };
        });

        const goodMatches = matches.filter(m => m.matchScore >= 10).sort((a, b) => b.matchScore - a.matchScore);

        console.log(`🎯 Generated ${goodMatches.length} matches`);
        res.json({ success: true, matches: goodMatches });
    } catch (error) {
        console.error('Error getting swipe matches:', error);
        res.json({ success: false, message: 'Error getting matches', matches: [] });
    }
});

// ============ SEND CONNECTION REQUEST ============
app.post('/send-connection-request', (req, res) => {
    const { learnerEmail, tutorEmail, subject, message, learnerGradeLevel, tutorGradeLevel } = req.body;

    try {
        const gradeCompatibility = {
            'elementary': ['elementary', 'junior_high'],
            'junior_high': ['elementary', 'junior_high', 'senior_high'],
            'senior_high': ['junior_high', 'senior_high', 'college'],
            'college': ['senior_high', 'college', 'postgrad'],
            'postgrad': ['college', 'postgrad', 'professional'],
            'professional': ['postgrad', 'professional']
        };

        const compatibleLevels = gradeCompatibility[learnerGradeLevel] || [];
        if (!compatibleLevels.includes(tutorGradeLevel)) {
            return res.json({ 
                success: false, 
                message: 'Grade level mismatch.' 
            });
        }

        const existing = query(
            "SELECT * FROM connection_requests WHERE learner_email = ? AND tutor_email = ? AND status IN ('pending', 'accepted')",
            [learnerEmail, tutorEmail]
        );

        if (existing.length > 0) {
            return res.json({ success: false, message: 'You already have a request with this user.' });
        }

        const connected = query(
            'SELECT * FROM connections WHERE (user1_email = ? AND user2_email = ?) OR (user1_email = ? AND user2_email = ?)',
            [learnerEmail, tutorEmail, tutorEmail, learnerEmail]
        );

        if (connected.length > 0) {
            return res.json({ success: false, message: 'You are already connected!' });
        }

        query(
            `INSERT INTO connection_requests (learner_email, tutor_email, subject, message, status, created_at) 
             VALUES (?, ?, ?, ?, 'pending', datetime('now', 'localtime'))`,
            [learnerEmail, tutorEmail, subject, message || '']
        );

        console.log(`📨 Connection request sent from ${learnerEmail} to ${tutorEmail}`);
        logDatabaseStats();

        res.json({ success: true, message: 'Connection request sent!' });
    } catch (error) {
        console.error('Error sending connection request:', error);
        res.json({ success: false, message: 'Error sending request' });
    }
});

// ============ GET PENDING CONNECTION REQUESTS ============
app.post('/get-pending-requests', (req, res) => {
    const { email } = req.body;

    try {
        const requests = query(
            `SELECT cr.*, 
                    u.name as learner_name, 
                    u.username as learner_username, 
                    u.profile_pic as learner_profile_pic,
                    u.grade_level as learner_grade,
                    u.bio as learner_bio
             FROM connection_requests cr
             JOIN users u ON cr.learner_email = u.email
             WHERE cr.tutor_email = ? AND cr.status = 'pending'
             ORDER BY cr.created_at DESC`,
            [email]
        );

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Error getting pending requests:', error);
        res.json({ success: false, message: 'Error getting requests', requests: [] });
    }
});

// ============ ACCEPT CONNECTION REQUEST ============
app.post('/accept-request', (req, res) => {
    const { requestId, tutorEmail, learnerEmail } = req.body;

    try {
        const learnerResult = query('SELECT credits FROM users WHERE email = ?', [learnerEmail]);
        if (learnerResult.length === 0 || learnerResult[0].credits < 1) {
            return res.json({ success: false, message: 'Learner does not have enough credits' });
        }

        query(
            "UPDATE connection_requests SET status = 'accepted', updated_at = datetime('now', 'localtime') WHERE id = ?",
            [requestId]
        );

        query(
            `INSERT INTO connections (user1_email, user2_email, status, created_at) 
             VALUES (?, ?, 'active', datetime('now', 'localtime'))`,
            [learnerEmail, tutorEmail]
        );

        console.log(`✅ Connection accepted: ${learnerEmail} <-> ${tutorEmail}`);
        logDatabaseStats();

        res.json({ success: true, message: 'Connection accepted!' });
    } catch (error) {
        console.error('Error accepting request:', error);
        res.json({ success: false, message: 'Error accepting request' });
    }
});

// ============ REJECT CONNECTION REQUEST ============
app.post('/reject-request', (req, res) => {
    const { requestId } = req.body;

    try {
        query("UPDATE connection_requests SET status = 'rejected', updated_at = datetime('now', 'localtime') WHERE id = ?", [requestId]);
        console.log(`❌ Connection request rejected: ${requestId}`);
        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.json({ success: false, message: 'Error rejecting request' });
    }
});

// ============ GET CONNECTIONS ============
app.post('/get-connections', (req, res) => {
    const { email } = req.body;

    try {
        const connections = query(
            `SELECT 
                CASE 
                    WHEN c.user1_email = ? THEN c.user2_email
                    ELSE c.user1_email
                END as connected_email,
                u.name as connected_name,
                u.username as connected_username,
                u.profile_pic as connected_profile_pic,
                c.created_at as connected_at
             FROM connections c
             JOIN users u ON (u.email = c.user1_email OR u.email = c.user2_email)
             WHERE (c.user1_email = ? OR c.user2_email = ?) AND u.email != ?
             ORDER BY c.created_at DESC`,
            [email, email, email, email]
        );

        res.json({ success: true, connections });
    } catch (error) {
        console.error('Error getting connections:', error);
        res.json({ success: false, message: 'Error getting connections', connections: [] });
    }
});

// ============ GET MESSAGES ============
app.post('/get-messages', (req, res) => {
    const { user1Email, user2Email } = req.body;

    try {
        const messages = query(
            `SELECT * FROM messages 
             WHERE (sender_email = ? AND receiver_email = ?) 
                OR (sender_email = ? AND receiver_email = ?)
             ORDER BY created_at ASC`,
            [user1Email, user2Email, user2Email, user1Email]
        );

        query(
            `UPDATE messages SET is_read = 1 
             WHERE receiver_email = ? AND sender_email = ? AND is_read = 0`,
            [user1Email, user2Email]
        );

        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.json({ success: false, message: 'Error getting messages', messages: [] });
    }
});

// ============ SEND MESSAGE ============
app.post('/send-message', (req, res) => {
    const { senderEmail, receiverEmail, message } = req.body;

    try {
        query(
            `INSERT INTO messages (sender_email, receiver_email, message, is_read, created_at) 
             VALUES (?, ?, ?, 0, datetime('now', 'localtime'))`,
            [senderEmail, receiverEmail, message]
        );

        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.json({ success: false, message: 'Error sending message' });
    }
});

// ============ GET LEDGER ============
app.post('/get-ledger', (req, res) => {
    const { email } = req.body;

    try {
        const transactions = query(
            `SELECT t.*, 
                    u_from.name as from_name, u_from.username as from_username,
                    u_to.name as to_name, u_to.username as to_username
             FROM transactions t
             JOIN users u_from ON t.from_email = u_from.email
             JOIN users u_to ON t.to_email = u_to.email
             WHERE t.from_email = ? OR t.to_email = ?
             ORDER BY t.created_at DESC`,
            [email, email]
        );

        res.json({ success: true, transactions });
    } catch (error) {
        console.error('Error getting ledger:', error);
        res.json({ success: false, message: 'Error getting ledger', transactions: [] });
    }
});

// ============ SEND SESSION REQUEST ============
app.post('/send-session-request', (req, res) => {
    const { learnerEmail, tutorEmail, subject, sessionNotes } = req.body;

    try {
        // Check if there's already an active or pending session
        const existingSession = query(
            `SELECT * FROM sessions 
             WHERE (learner_email = ? AND tutor_email = ?) 
                OR (learner_email = ? AND tutor_email = ?)
             AND status IN ('pending', 'active')`,
            [learnerEmail, tutorEmail, tutorEmail, learnerEmail]
        );

        if (existingSession.length > 0) {
            return res.json({ success: false, message: 'You already have a pending or active session with this user.' });
        }

        // Check if learner has enough credits
        const learnerResult = query('SELECT credits FROM users WHERE email = ?', [learnerEmail]);
        if (learnerResult.length === 0 || learnerResult[0].credits < 1) {
            return res.json({ success: false, message: 'You need at least 1 credit to request a session.' });
        }

        query(
            `INSERT INTO sessions (learner_email, tutor_email, subject, session_notes, status, created_at) 
             VALUES (?, ?, ?, ?, 'pending', datetime('now', 'localtime'))`,
            [learnerEmail, tutorEmail, subject, sessionNotes || '']
        );

        console.log(`📅 Session request sent from ${learnerEmail} to ${tutorEmail}`);
        logDatabaseStats();
        
        res.json({ success: true, message: 'Session request sent to tutor!' });
    } catch (error) {
        console.error('Error sending session request:', error);
        res.json({ success: false, message: 'Error sending session request' });
    }
});

// ============ GET PENDING SESSION REQUESTS FOR TUTOR ============
app.post('/get-pending-session-requests', (req, res) => {
    const { tutorEmail } = req.body;

    try {
        const sessions = query(
            `SELECT s.*, 
                    u.name as learner_name, 
                    u.username as learner_username, 
                    u.profile_pic as learner_profile_pic,
                    u.grade_level as learner_grade
             FROM sessions s
             JOIN users u ON s.learner_email = u.email
             WHERE s.tutor_email = ? AND s.status = 'pending'
             ORDER BY s.created_at DESC`,
            [tutorEmail]
        );

        res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error getting pending session requests:', error);
        res.json({ success: false, message: 'Error getting requests', sessions: [] });
    }
});

// ============ GET ACTIVE SESSION FOR USER ============
app.post('/get-active-session', (req, res) => {
    const { email } = req.body;

    try {
        const session = query(
            `SELECT s.*, 
                    CASE 
                        WHEN s.learner_email = ? THEN 'learner'
                        ELSE 'tutor'
                    END as user_role,
                    u1.name as learner_name, u1.username as learner_username, u1.profile_pic as learner_profile_pic,
                    u2.name as tutor_name, u2.username as tutor_username, u2.profile_pic as tutor_profile_pic
             FROM sessions s
             JOIN users u1 ON s.learner_email = u1.email
             JOIN users u2 ON s.tutor_email = u2.email
             WHERE (s.learner_email = ? OR s.tutor_email = ?) 
             AND s.status IN ('pending', 'active')
             ORDER BY s.created_at DESC
             LIMIT 1`,
            [email, email, email]
        );

        if (session.length > 0) {
            res.json({ success: true, session: session[0] });
        } else {
            res.json({ success: true, session: null });
        }
    } catch (error) {
        console.error('Error getting active session:', error);
        res.json({ success: false, message: 'Error getting session', session: null });
    }
});

// ============ ACCEPT SESSION REQUEST ============
app.post('/accept-session-request', (req, res) => {
    const { sessionId, tutorEmail, learnerEmail } = req.body;

    try {
        // Verify learner still has credits
        const learnerResult = query('SELECT credits FROM users WHERE email = ?', [learnerEmail]);
        if (learnerResult.length === 0 || learnerResult[0].credits < 1) {
            return res.json({ success: false, message: 'Learner does not have enough credits for this session.' });
        }

        // Get tutor's current credits
        const tutorResult = query('SELECT credits FROM users WHERE email = ?', [tutorEmail]);
        const tutorCredits = tutorResult[0]?.credits || 0;
        const learnerCredits = learnerResult[0].credits;

        // Start transaction - deduct 1 credit from learner, add 1 to tutor
        query('UPDATE users SET credits = ? WHERE email = ?', [learnerCredits - 1, learnerEmail]);
        query('UPDATE users SET credits = ? WHERE email = ?', [tutorCredits + 1, tutorEmail]);

        // Update session status to active and set start time
        query(
            `UPDATE sessions SET status = 'active', session_start = datetime('now', 'localtime') WHERE id = ?`,
            [sessionId]
        );

        // Record transaction in ledger
        query(
            `INSERT INTO transactions (from_email, to_email, amount, type, session_id, created_at) 
             VALUES (?, ?, 1, 'session_payment', ?, datetime('now', 'localtime'))`,
            [learnerEmail, tutorEmail, sessionId]
        );

        console.log(`✅ Session accepted: ${sessionId} - Credit transferred from ${learnerEmail} to ${tutorEmail}`);
        logDatabaseStats();

        res.json({ success: true, message: 'Session accepted! Timer started.' });
    } catch (error) {
        console.error('Error accepting session:', error);
        res.json({ success: false, message: 'Error accepting session' });
    }
});

// ============ REJECT SESSION REQUEST ============
app.post('/reject-session-request', (req, res) => {
    const { sessionId } = req.body;

    try {
        query("UPDATE sessions SET status = 'rejected', updated_at = datetime('now', 'localtime') WHERE id = ?", [sessionId]);
        console.log(`❌ Session request rejected: ${sessionId}`);
        res.json({ success: true, message: 'Session request rejected' });
    } catch (error) {
        console.error('Error rejecting session:', error);
        res.json({ success: false, message: 'Error rejecting session' });
    }
});

// ============ COMPLETE SESSION ============
app.post('/complete-session', (req, res) => {
    const { sessionId, rating, feedback } = req.body;

    try {
        query(
            `UPDATE sessions SET status = 'completed', rating = ?, feedback = ?, session_end = datetime('now', 'localtime') WHERE id = ?`,
            [rating || null, feedback || null, sessionId]
        );
        
        // Update tutor's rating average if rating provided
        if (rating) {
            const sessionResult = query('SELECT tutor_email FROM sessions WHERE id = ?', [sessionId]);
            if (sessionResult.length > 0) {
                const tutorEmail = sessionResult[0].tutor_email;
                const allRatings = query('SELECT AVG(rating) as avg_rating FROM sessions WHERE tutor_email = ? AND rating IS NOT NULL', [tutorEmail]);
                if (allRatings.length > 0 && allRatings[0].avg_rating) {
                    query('UPDATE users SET rating = ? WHERE email = ?', [allRatings[0].avg_rating, tutorEmail]);
                }
            }
        }

        console.log(`✅ Session completed: ${sessionId}`);
        res.json({ success: true, message: 'Session completed!' });
    } catch (error) {
        console.error('Error completing session:', error);
        res.json({ success: false, message: 'Error completing session' });
    }
});

// ============ GET SESSION HISTORY ============
app.post('/get-session-history', (req, res) => {
    const { email } = req.body;

    try {
        const sessions = query(
            `SELECT s.*, 
                    CASE 
                        WHEN s.learner_email = ? THEN 'learner'
                        ELSE 'tutor'
                    END as user_role,
                    u1.name as learner_name,
                    u2.name as tutor_name
             FROM sessions s
             JOIN users u1 ON s.learner_email = u1.email
             JOIN users u2 ON s.tutor_email = u2.email
             WHERE (s.learner_email = ? OR s.tutor_email = ?) 
             AND s.status != 'pending'
             ORDER BY s.created_at DESC
             LIMIT 20`,
            [email, email, email]
        );

        res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error getting session history:', error);
        res.json({ success: false, message: 'Error getting history', sessions: [] });
    }
});

// ============ CREATE TABLES ============
function initDatabase() {
    db.pragma('foreign_keys = ON');

    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            username TEXT,
            bio TEXT,
            achievements TEXT,
            skills TEXT,
            growth TEXT,
            credits INTEGER DEFAULT 5,
            rating REAL DEFAULT 0,
            profile_pic TEXT,
            grade_level TEXT,
            profile_completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createConnectionRequestsTable = `
        CREATE TABLE IF NOT EXISTS connection_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            learner_email TEXT NOT NULL,
            tutor_email TEXT NOT NULL,
            subject TEXT,
            message TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (learner_email) REFERENCES users(email),
            FOREIGN KEY (tutor_email) REFERENCES users(email)
        )
    `;

    const createConnectionsTable = `
        CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_email TEXT NOT NULL,
            user2_email TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user1_email) REFERENCES users(email),
            FOREIGN KEY (user2_email) REFERENCES users(email),
            UNIQUE(user1_email, user2_email)
        )
    `;

    const createMessagesTable = `
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_email TEXT NOT NULL,
            receiver_email TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_email) REFERENCES users(email),
            FOREIGN KEY (receiver_email) REFERENCES users(email)
        )
    `;

    const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT NOT NULL,
            to_email TEXT NOT NULL,
            amount INTEGER NOT NULL,
            type TEXT DEFAULT 'session_payment',
            session_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_email) REFERENCES users(email),
            FOREIGN KEY (to_email) REFERENCES users(email)
        )
    `;

    const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            learner_email TEXT NOT NULL,
            tutor_email TEXT NOT NULL,
            subject TEXT,
            session_notes TEXT,
            status TEXT DEFAULT 'pending',
            rating INTEGER,
            feedback TEXT,
            session_start DATETIME,
            session_end DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (learner_email) REFERENCES users(email),
            FOREIGN KEY (tutor_email) REFERENCES users(email)
        )
    `;

    try {
        query(createUsersTable);
        query(createConnectionRequestsTable);
        query(createConnectionsTable);
        query(createMessagesTable);
        query(createTransactionsTable);
        query(createSessionsTable);
        console.log('✅ Database tables ready');
        logDatabaseStats();
        console.log('🚀 Server ready for connections\n');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

// ============ START SERVER ============
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    initDatabase();
});