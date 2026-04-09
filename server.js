// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('users.db');

// CREATE TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT,
    skills TEXT,
    growth TEXT,
    profile_pic TEXT
)
`);

// REGISTER
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword],
            function(err){
                if(err) return res.json({ success:false, message:'Email already exists' });
                res.json({ success:true });
            }
        );
    } catch(err){
        res.json({ success:false, message: 'Server error' });
    }
});

// LOGIN
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email=?", [email], async (err, user) => {
        if(err || !user) return res.json({ success:false, message: 'User not found' });
        const match = await bcrypt.compare(password, user.password);
        if(!match) return res.json({ success:false, message:'Incorrect password' });
        res.json({ 
            success:true, 
            name: user.name,
            email: user.email,
            username: user.username,
            skills: JSON.parse(user.skills || "[]"),
            growth: JSON.parse(user.growth || "[]"),
            profile_pic: user.profile_pic || null
        });
    });
});

// COMPLETE PROFILE
app.post('/complete-profile', (req, res) => {
    const { email, username, skills, growth, profile_pic } = req.body;
    // Ensure username is unique
    db.get("SELECT * FROM users WHERE username=? AND email!=?", [username, email], (err, existingUser) => {
        if(err) return res.json({ success:false, message:'Database error' });
        if(existingUser) return res.json({ success:false, message:'Username already taken' });

        db.run(
            "UPDATE users SET username=?, skills=?, growth=?, profile_pic=? WHERE email=?",
            [username, JSON.stringify(skills), JSON.stringify(growth), profile_pic || null, email],
            function(err){
                if(err) return res.json({ success:false, message:'Failed to update profile' });
                res.json({ success:true });
            }
        );
    });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));