const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

//middleware - whats it?
const app = express();
app.use(express.json());
app.use(cors());

// to open html when launching port 3000
app.use(express.static('public'));

const db = new sqlite3.Database('users.db');

// CREATE TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    skills TEXT,
    role TEXT
)
`);



//FOR LOGIN Button front end connect to backendOrDatabases
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email=?", [email], async (err, user) => {
        if(err || !user) return res.json({ success:false, message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if(!match) return res.json({ success:false, message: "Incorrect password" });

        res.json({ success:true, name: user.name, role: user.role, skills: JSON.parse(user.skills || "[]") });
    });
});

// REGISTER front end connect to backendOrDatabases
const bcrypt = require('bcryptjs');

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword],
        (err) => {
            if(err) return res.json({ success:false, message: 'Email already exists' });
            res.json({ success:true });
        }
    );
});

// COMPLETE PROFILE
app.post('/complete-profile', (req, res) => {
    const { email, skills, role } = req.body;

    db.run(
        "UPDATE users SET skills=?, role=? WHERE email=?",
        [JSON.stringify(skills), role, email],
        (err) => {
            if(err) return res.json({ success:false });
            res.json({ success:true });
        }
    );
});


app.listen(3000, () => console.log("Server running on port 3000"));