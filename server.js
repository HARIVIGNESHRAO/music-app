const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 5000;
const TURNSTILE_SECRET_KEY = '0x4AAAAAAB4cfnEQeR8gN6MDwHfgMITz77c';
const GOOGLE_CLIENT_ID = '423273358250-5sh66sd211creanihac75uaith2vhh1e.apps.googleusercontent.com'; // Replace with your Google Client ID

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB Atlas Connection
const mongoURI = 'mongodb+srv://harisonu151:zZYoHOEqz8eiI3qP@salaar.st5tm.mongodb.net/musicstream?retryWrites=true&w=majority';

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google users
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    joinDate: { type: Date, default: Date.now },
    googleId: { type: String, unique: true, sparse: true } // Add googleId field
});

const User = mongoose.model('User', userSchema);

// Seed Admin User (Run this once manually if needed)
/*
(async () => {
  const adminExists = await User.findOne({ username: 'salaar' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('salaar', 10);
    const admin = new User({
      username: 'salaar',
      email: 'admin@music.com',
      password: hashedPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin user created');
  }
})();
*/

// Verify Turnstile Token
const verifyTurnstileToken = async (token) => {
    try {
        const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            secret: TURNSTILE_SECRET_KEY,
            response: token,
        });
        return response.data.success;
    } catch (err) {
        console.error('Turnstile verification error:', err);
        return false;
    }
};

// Verify Google ID Token
const verifyGoogleToken = async (token) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return payload; // Contains user info like email, sub (googleId), etc.
    } catch (err) {
        console.error('Google token verification error:', err);
        return null;
    }
};

// Google Login Endpoint
app.post('/api/google-login', async (req, res) => {
    const { googleToken } = req.body;

    if (!googleToken) {
        return res.status(400).json({ message: 'Google token is required' });
    }

    try {
        const payload = await verifyGoogleToken(googleToken);
        if (!payload) {
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        const { sub: googleId, email, name } = payload;

        // Check if user exists by googleId or email
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            // Create a new user
            const username = name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000); // Generate unique username
            user = new User({
                username,
                email,
                googleId,
                role: 'user',
            });
            await user.save();
        } else if (!user.googleId) {
            // Link Google ID to existing user
            user.googleId = googleId;
            await user.save();
        }

        res.status(200).json({
            message: 'Google login successful',
            user: { id: user._id, username: user.username, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Signup Endpoint
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully', user: { id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password, turnstileToken } = req.body;
    try {
        // Verify Turnstile token
        if (!turnstileToken) {
            return res.status(400).json({ message: 'CAPTCHA verification required' });
        }
        const isTurnstileValid = await verifyTurnstileToken(turnstileToken);
        if (!isTurnstileValid) {
            return res.status(400).json({ message: 'Invalid CAPTCHA verification' });
        }

        // Proceed with login
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({ message: 'Login successful', user: { id: user._id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// Get All Users (For Admin)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Exclude passwords
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});