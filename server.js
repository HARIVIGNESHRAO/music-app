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
const GOOGLE_CLIENT_ID = '423273358250-5sh66sd211creanihac75uaith2vhh1e.apps.googleusercontent.com';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB Atlas Connection
const mongoURI = 'mongodb+srv://harisonu151:zZYoHOEqz8eiI3qP@salaar.st5tm.mongodb.net/musicstream?retryWrites=true&w=majority';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google users
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    joinDate: { type: Date, default: Date.now },
    googleId: { type: String, unique: true, sparse: true }
});

const User = mongoose.model('User', userSchema);

// Seed Admin User
const seedAdminUser = async () => {
    try {
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
        } else {
            console.log('Admin user already exists');
        }
    } catch (err) {
        console.error('Error seeding admin user:', err);
    }
};
seedAdminUser();

// Middleware to verify admin role
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.headers['user-id'];
        console.log('isAdmin middleware: Received user-id:', userId);
        if (!userId) {
            console.log('isAdmin middleware: User ID missing');
            return res.status(401).json({ message: 'User ID required' });
        }
        const user = await User.findById(userId);
        if (!user) {
            console.log('isAdmin middleware: User not found for ID:', userId);
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role !== 'admin') {
            console.log('isAdmin middleware: User is not admin:', user.username);
            return res.status(403).json({ message: 'Admin access required' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('isAdmin middleware error:', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Verify Turnstile Token
const verifyTurnstileToken = async (token) => {
    try {
        const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            secret: TURNSTILE_SECRET_KEY,
            response: token,
        });
        return response.data.success;
    } catch (err) {
        console.error('Turnstile verification error:', err.message);
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
        return ticket.getPayload();
    } catch (err) {
        console.error('Google token verification error:', err.message);
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

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            const username = name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
            user = new User({
                username,
                email,
                googleId,
                role: email === 'admin@music.com' ? 'admin' : 'user',
            });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        res.status(200).json({
            message: 'Google login successful',
            user: { id: user._id, username: user.username, email: user.email, role: user.role, joinDate: user.joinDate }
        });
    } catch (err) {
        console.error('Google login error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Signup Endpoint
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({
                message: existingUser.username === username ? 'Username already exists' : 'Email already exists'
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({
            message: 'User created successfully',
            user: { id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role, joinDate: newUser.joinDate }
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password, turnstileToken } = req.body;
    try {
        if (!turnstileToken) {
            return res.status(400).json({ message: 'CAPTCHA verification required' });
        }
        const isTurnstileValid = await verifyTurnstileToken(turnstileToken);
        if (!isTurnstileValid) {
            return res.status(400).json({ message: 'Invalid CAPTCHA verification' });
        }

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        if (!user.password) {
            return res.status(400).json({ message: 'Use Google login for this account' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({
            message: 'Login successful',
            user: { id: user._id, username: user.username, email: user.email, role: user.role, joinDate: user.joinDate }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get All Users (For Admin)
app.get('/api/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password -googleId'); // Exclude sensitive fields
        console.log('Fetched users:', users);
        res.status(200).json(users || []);
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete User (For Admin)
app.delete('/api/users/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});