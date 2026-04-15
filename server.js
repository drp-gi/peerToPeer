// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();

app.use(cors());    
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));

// Use an absolute path for the database file to ensure it persists
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

console.log(`Database path: ${dbPath}`);

// Create table if not exists (won't delete existing data)
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        username TEXT UNIQUE,
        password TEXT,
        skills TEXT,
        growth TEXT,
        grade_level TEXT,
        profile_pic TEXT,
        credits INTEGER DEFAULT 5,
        last_login_date TEXT
    )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Database table ready');
            // Add grade_level column if it doesn't exist (migration for existing DBs)
            db.run(`ALTER TABLE users ADD COLUMN grade_level TEXT`, (err) => {
              if (err && !err.message.includes('duplicate column')) {
                console.error('Migration error:', err);
              }
            });
            // Count users to verify data exists
            db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
                if (!err && result) {
                    console.log(`Total users in database: ${result.count}`);
                }
            });
        }
    });
});

// REGISTER
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('Registration attempt for:', email);
    
    db.get("SELECT email FROM users WHERE email = ?", [email], async (err, existingUser) => {
        if (err) {
            console.error('Database error:', err);
            return res.json({ success: false, message: 'Database error' });
        }
        
        if (existingUser) {
            console.log('User already exists:', email);
            return res.json({ success: false, message: 'Email already registered' });
        }
        
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run(
                "INSERT INTO users (name, email, password, credits) VALUES (?, ?, ?, 5)",
                [name, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Insert error:', err);
                        return res.json({ success: false, message: 'Registration failed' });
                    }
                    console.log('User registered successfully:', email);
                    res.json({ success: true, message: 'Registered successfully' });
                }
            );
        } catch(err) {
            console.error('Hash error:', err);
            res.json({ success: false, message: 'Server error' });
        }
    });
});

// LOGIN
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.json({ success: false, message: 'Database error' });
        }
        
        if (!user) {
            console.log('User not found:', email);
            return res.json({ success: false, message: 'Account does not exist' });
        }
        
        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log('Invalid password for:', email);
                return res.json({ success: false, message: 'Incorrect password' });
            }
            
            console.log('Login successful for:', email, 'Credits:', user.credits);
            res.json({ 
                success: true, 
                name: user.name,
                email: user.email,
                username: user.username,
                skills: JSON.parse(user.skills || "[]"),
                growth: JSON.parse(user.growth || "[]"),
                grade_level: user.grade_level || '',
                profile_pic: user.profile_pic || null,
                credits: user.credits || 5,
                last_login_date: user.last_login_date || null
            });
        } catch(err) {
            console.error('Password comparison error:', err);
            res.json({ success: false, message: 'Server error' });
        }
    });
});

// COMPLETE PROFILE
app.post('/complete-profile', (req, res) => {
    const { email, username, skills, growth, grade_level, profile_pic } = req.body;
    console.log('Completing profile for:', email);
    
    db.get("SELECT * FROM users WHERE username = ? AND email != ?", [username, email], (err, existingUser) => {
        if (err) {
            console.error('Database error:', err);
            return res.json({ success: false, message: 'Database error' });
        }
        
        if (existingUser) {
            console.log('Username already taken:', username);
            return res.json({ success: false, message: 'Username already taken' });
        }

        db.run(
            "UPDATE users SET username = ?, skills = ?, growth = ?, grade_level = ?, profile_pic = ? WHERE email = ?",
            [username, JSON.stringify(skills), JSON.stringify(growth), grade_level || null, profile_pic || null, email],
            function(err) {
                if (err) {
                    console.error('Update error:', err);
                    return res.json({ success: false, message: 'Failed to update profile' });
                }
                console.log('Profile completed for:', email);
                res.json({ success: true });
            }
        );
    });
});

// GET USER DATA
app.post('/get-user-data', (req, res) => {
    const { email } = req.body;
    db.get("SELECT username, profile_pic, credits, last_login_date FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ 
            success: true, 
            username: user.username,
            profile_pic: user.profile_pic,
            credits: user.credits || 5,
            last_login_date: user.last_login_date
        });
    });
});

// UPDATE CREDITS
app.post('/update-credits', (req, res) => {
    const { email, credits, last_login_date } = req.body;
    console.log(`Updating credits for ${email} to ${credits}`);
    
    db.run(
        "UPDATE users SET credits = ?, last_login_date = ? WHERE email = ?",
        [credits, last_login_date, email],
        function(err) {
            if (err) {
                console.error('Error updating credits:', err);
                return res.json({ success: false, message: 'Failed to update credits' });
            }
            console.log(`Credits updated successfully for ${email} to ${credits}`);
            res.json({ success: true });
        }
    );
});

// Get all users (for debugging)
app.get('/users', (req, res) => {
    db.all("SELECT id, name, email, username, credits, last_login_date FROM users", (err, users) => {
        if (err) {
            return res.json({ success: false, message: 'Error fetching users' });
        }
        res.json({ success: true, users });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));