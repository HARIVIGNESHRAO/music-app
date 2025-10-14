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
const crypto = require('crypto');
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
// Share Schema
const shareSchema = new mongoose.Schema({
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Share = mongoose.model('Share', shareSchema);
const playlistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    songs: [{
        id: { type: String, required: true }, // YouTube video ID
        title: { type: String, required: true },
        artist: { type: String, required: true },
        album: { type: String },
        duration: { type: String },
        cover: { type: String },
        genre: { type: String },
        plays: { type: Number, default: 0 }
    }],
    cover: { type: String, default: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Playlist = mongoose.model('Playlist', playlistSchema);

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
app.post('/api/playlists/:id/share', async (req, res) => {
    try {
        const { userId } = req.body;
        const { id: playlistId } = req.params;

        // Validate input
        if (!userId || !playlistId) {
            return res.status(400).json({ message: 'userId and playlistId are required' });
        }

        // Verify the playlist exists and belongs to the user
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }
        if (playlist.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this playlist' });
        }

        // Generate a unique token
        const shareToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiration

        // Save the share record
        const shareRecord = new Share({
            playlistId,
            userId,
            token: shareToken,
            expiresAt
        });
        await shareRecord.save();

        res.status(200).json({ shareToken });
    } catch (err) {
        console.error('Generate share token error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});
// Retrieve a shared playlist
app.get('/api/shared/playlist/:id', async (req, res) => {
    try {
        const { id: playlistId } = req.params;
        const { token } = req.query;

        // Validate input
        if (!playlistId || !token) {
            return res.status(400).json({ message: 'playlistId and token are required' });
        }

        // Find the share record
        const shareRecord = await Share.findOne({ playlistId, token });
        if (!shareRecord) {
            return res.status(403).json({ message: 'Invalid or expired share link' });
        }

        // Check if the token has expired
        if (shareRecord.expiresAt < new Date()) {
            await Share.deleteOne({ _id: shareRecord._id }); // Clean up expired token
            return res.status(403).json({ message: 'Share link has expired' });
        }

        // Fetch the playlist
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        res.status(200).json(playlist);
    } catch (err) {
        console.error('Fetch shared playlist error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});
// Get user's playlists
app.get('/api/playlists/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const playlists = await Playlist.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json(playlists || []);
    } catch (err) {
        console.error('Fetch playlists error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create new playlist
app.post('/api/playlists', async (req, res) => {
    try {
        const { name, userId, cover } = req.body;

        if (!name || !userId) {
            return res.status(400).json({ message: 'Name and userId are required' });
        }

        const newPlaylist = new Playlist({
            name,
            userId,
            songs: [],
            cover: cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'
        });

        await newPlaylist.save();
        res.status(201).json({ message: 'Playlist created successfully', playlist: newPlaylist });
    } catch (err) {
        console.error('Create playlist error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Add song to playlist
app.post('/api/playlists/:playlistId/songs', async (req, res) => {
    try {
        const { playlistId } = req.params;
        const song = req.body;

        if (!song || !song.id) {
            return res.status(400).json({ message: 'Valid song data required' });
        }

        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check if song already exists
        const songExists = playlist.songs.some(s => s.id === song.id);
        if (songExists) {
            return res.status(400).json({ message: 'Song already in playlist' });
        }

        playlist.songs.push(song);
        playlist.updatedAt = Date.now();

        // Update cover if it's the first song
        if (playlist.songs.length === 1 && song.cover) {
            playlist.cover = song.cover;
        }

        await playlist.save();
        res.status(200).json({ message: 'Song added successfully', playlist });
    } catch (err) {
        console.error('Add song error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Remove song from playlist
app.delete('/api/playlists/:playlistId/songs/:songId', async (req, res) => {
    try {
        const { playlistId, songId } = req.params;

        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        playlist.songs = playlist.songs.filter(s => s.id !== songId);
        playlist.updatedAt = Date.now();

        await playlist.save();
        res.status(200).json({ message: 'Song removed successfully', playlist });
    } catch (err) {
        console.error('Remove song error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete playlist
app.delete('/api/playlists/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params;
        const playlist = await Playlist.findByIdAndDelete(playlistId);

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        res.status(200).json({ message: 'Playlist deleted successfully' });
    } catch (err) {
        console.error('Delete playlist error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update playlist name
// Update playlist name and cover
app.put('/api/playlists/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params;
        const { name, cover } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Playlist name required' });
        }

        const updateData = { name, updatedAt: Date.now() };
        if (cover) {
            updateData.cover = cover;
        }

        const playlist = await Playlist.findByIdAndUpdate(
            playlistId,
            updateData,
            { new: true }
        );

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        res.status(200).json({ message: 'Playlist updated successfully', playlist });
    } catch (err) {
        console.error('Update playlist error:', err);
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

// Get All Users (Public endpoint - removed admin authentication)
app.get('/api/users', async (req, res) => {
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