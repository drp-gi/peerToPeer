// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();

app.use(cors());    
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));

const db = new sqlite3.Database('users.db');

// DROP and recreate tables to ensure clean state
db.serialize(() => {
    // Drop existing tables if they exist
    db.run(`DROP TABLE IF EXISTS users`);
    
    // Create fresh table
    db.run(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        username TEXT UNIQUE,
        password TEXT,
        skills TEXT,
        growth TEXT,
        profile_pic TEXT,
        credits INTEGER DEFAULT 5,
        last_login_date TEXT
    )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Database table created successfully');
        }
    });
});

// REGISTER
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('Registration attempt for:', email);
    
    // First check if user exists
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
    const { email, username, skills, growth, profile_pic } = req.body;
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
            "UPDATE users SET username = ?, skills = ?, growth = ?, profile_pic = ? WHERE email = ?",
            [username, JSON.stringify(skills), JSON.stringify(growth), profile_pic || null, email],
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

app.listen(3000, () => console.log("Server running on http://localhost:3000"));