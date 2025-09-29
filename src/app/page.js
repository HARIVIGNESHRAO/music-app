'use client';

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, Users, BarChart3, Shield
} from 'lucide-react';
import crypto from 'crypto-js';

export default function Page() {
    const [currentUser, setCurrentUser] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(70);
    const [activeTab, setActiveTab] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [playlists, setPlaylists] = useState([]);
    const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [songs, setSongs] = useState([]);
    const [filteredSongs, setFilteredSongs] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const audioRef = useRef(null);

    // Spotify config
    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public';
    const CODE_CHALLENGE_METHOD = 'S256';

    // Static users for admin
    const [users] = useState([
        { id: 1, name: "Alex Johnson", email: "alex@music.com", role: "user", joinDate: "2024-01-15" },
        { id: 2, name: "Sarah Chen", email: "sarah@music.com", role: "user", joinDate: "2024-02-20" },
        { id: 3, name: "Mike Wilson", email: "mike@music.com", role: "admin", joinDate: "2023-12-01" }
    ]);

    // Generate PKCE code verifier and challenge
    const generateCodeVerifier = () => {
        return crypto.lib.WordArray.random(32).toString(crypto.enc.Base64url);
    };

    const generateCodeChallenge = (verifier) => {
        const hashed = crypto.SHA256(verifier).toString(crypto.enc.Base64url);
        return hashed;
    };

    useEffect(() => {
        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
        }
    }, []);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume / 100;
    }, [volume]);

    useEffect(() => {
        if (audioRef.current && currentSong?.preview_url) {
            audioRef.current.src = currentSong.preview_url;
            if (isPlaying) {
                audioRef.current.play().catch((err) => {
                    console.error('Playback error:', err);
                    if (err.name === 'NotAllowedError') {
                        setError('Playback blocked by browser. Please interact with the page first.');
                    } else if (err.name === 'NotSupportedError') {
                        setError('Audio format not supported by your browser.');
                    } else {
                        setError('Failed to play preview: ' + err.message);
                    }
                    setIsPlaying(false);
                });
            } else {
                audioRef.current.pause();
            }
        } else if (currentSong && !currentSong.preview_url) {
            setError('No preview available for this song');
            setIsPlaying(false);
        }
    }, [isPlaying, currentSong]);

    const fetchUserProfile = async (token) => {
        try {
            setLoading(true);
            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCurrentUser({
                id: data.id,
                name: data.display_name,
                email: data.email,
                avatar: data.images?.[0]?.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center'
            });
            setIsAdmin(data.email === 'admin@music.com');
            await Promise.all([fetchTopTracks(token), fetchUserPlaylists(token)]);
        } catch (err) {
            console.error('Profile error:', err);
            setError('Failed to fetch profile: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchTopTracks = async (token) => {
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const mappedSongs = data.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || 'default-cover',
                genre: 'Unknown',
                plays: 0,
                preview_url: track.preview_url || null,
            }));
            setSongs(mappedSongs);
        } catch (err) {
            setError('Failed to fetch tracks');
        }
    };

    const fetchUserPlaylists = async (token) => {
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me/playlists?limit=10', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const mappedPlaylists = data.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                songs: [],
                cover: playlist.images[0]?.url || 'default-cover',
            }));
            setPlaylists(mappedPlaylists);
        } catch (err) {
            setError('Failed to fetch playlists');
        }
    };

    const searchSongs = async (query) => {
        if (!accessToken || !query) return;
        try {
            setLoading(true);
            const { data } = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const mappedSongs = data.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || 'default-cover',
                genre: 'Unknown',
                plays: 0,
                preview_url: track.preview_url || null,
            }));
            setFilteredSongs(mappedSongs);
        } catch (err) {
            setError('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSpotifyLogin = () => {
        const codeVerifier = generateCodeVerifier();
        window.localStorage.setItem('spotify_code_verifier', codeVerifier);
        const codeChallenge = generateCodeChallenge(codeVerifier);

        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=${RESPONSE_TYPE}&code_challenge=${codeChallenge}&code_challenge_method=${CODE_CHALLENGE_METHOD}`;
        window.location.href = authUrl;
    };

    const handleLogout = () => {
        setAccessToken(null);
        setCurrentUser(null);
        setIsAdmin(false);
        setCurrentSong(null);
        setIsPlaying(false);
        setActiveTab('home');
        setSongs([]);
        setFilteredSongs([]);
        setPlaylists([]);
        window.localStorage.removeItem('spotify_token');
        window.localStorage.removeItem('spotify_code_verifier');
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const selectSong = (song) => {
        if (!song.preview_url) {
            setError('No preview available for this song');
            setCurrentSong(song);
            setIsPlaying(false);
            return;
        }
        setCurrentSong(song);
        setIsPlaying(true);
        setError(null);
    };

    const handleSeek = (e) => {
        if (audioRef.current && duration) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const seekTime = (clickX / width) * duration;
            audioRef.current.currentTime = seekTime;
            setCurrentTime(seekTime);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const createPlaylist = async () => {
        if (!newPlaylistName.trim() || !accessToken) return;
        try {
            const { data } = await axios.post(
                `https://api.spotify.com/v1/users/${currentUser.id}/playlists`,
                { name: newPlaylistName, public: true },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            setPlaylists(prev => [...prev, {
                id: data.id,
                name: data.name,
                songs: [],
                cover: data.images[0]?.url || 'default-cover',
            }]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
        } catch (err) {
            setError('Failed to create playlist');
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query) searchSongs(query);
    };

    if (!currentUser || !accessToken) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="logo-container">
                            <Music className="logo-icon" />
                        </div>
                        <h1 className="app-title">MusicStream</h1>
                        <p className="app-subtitle">Your personal music companion</p>
                    </div>
                    <div className="login-buttons">
                        <button onClick={handleSpotifyLogin} className="login-btn user-btn">
                            Login with Spotify
                        </button>
                        <button
                            onClick={() => handleLogin("admin@music.com", "password", "admin")}
                            className="login-btn admin-btn"
                        >
                            Login as Admin (Local)
                        </button>
                    </div>
                    {loading && <p>Loading...</p>}
                    {error && <p className="error-text">Error: {error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <audio
                ref={audioRef}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => {
                    if (audioRef.current) {
                        setDuration(audioRef.current.duration || 30);
                    } else {
                        setError('Failed to load audio metadata');
                    }
                }}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
                onError={() => setError('Error loading audio file')}
            />

            <header className="header">
                <div className="header-content">
                    <div className="header-left">
                        <Music className="header-logo" />
                        <h1 className="header-title">MusicStream</h1>
                    </div>
                    <div className="header-center">
                        <div className="search-container">
                            <Search className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search songs, artists, albums..."
                                value={searchQuery}
                                onChange={handleSearch}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <div className="header-right">
                        <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar" />
                        <span className="user-name">{currentUser.name}</span>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <div className="main-layout">
                <aside className="sidebar">
                    <nav className="nav-menu">
                        <button onClick={() => setActiveTab('home')} className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}>
                            <Home className="nav-icon" /><span>Home</span>
                        </button>
                        <button onClick={() => setActiveTab('search')} className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}>
                            <Search className="nav-icon" /><span>Search</span>
                        </button>
                        <button onClick={() => setActiveTab('playlists')} className={`nav-item ${activeTab === 'playlists' ? 'active' : ''}`}>
                            <Music className="nav-icon" /><span>My Playlists</span>
                        </button>
                        {isAdmin && (
                            <button onClick={() => setActiveTab('admin')} className={`nav-item ${activeTab === 'admin' ? 'active admin' : ''}`}>
                                <Shield className="nav-icon" /><span>Admin Panel</span>
                            </button>
                        )}
                    </nav>
                    <div className="quick-playlists">
                        <h3 className="quick-title">Quick Playlists</h3>
                        <div className="playlist-list">
                            {playlists.slice(0, 3).map((playlist) => (
                                <div key={playlist.id} className="playlist-item">
                                    <img src={playlist.cover} alt={playlist.name} className="playlist-cover" />
                                    <div className="playlist-info">
                                        <p className="playlist-name">{playlist.name}</p>
                                        <p className="playlist-count">{playlist.songs.length} songs</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    {activeTab === 'home' && (
                        <div className="home-content">
                            <div className="welcome-section">
                                <h2 className="welcome-title">Welcome back, {currentUser.name}!</h2>
                                {loading ? (
                                    <p>Loading...</p>
                                ) : error ? (
                                    <p className="error-text">{error}</p>
                                ) : (
                                    <>
                                        <div className="featured-songs">
                                            {songs.map((song) => (
                                                <div key={song.id} className="song-card" onClick={() => selectSong(song)}>
                                                    <div className="song-cover-container">
                                                        <img src={song.cover} alt={song.title} className="song-cover" />
                                                        <button className="play-overlay"><Play className="play-icon" /></button>
                                                    </div>
                                                    <h3 className="song-title">{song.title}</h3>
                                                    <p className="song-artist">{song.artist}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="recent-section">
                                            <h3 className="section-title">Recently Played</h3>
                                            <div className="recent-list">
                                                {songs.slice(0, 3).map((song) => (
                                                    <div key={song.id} className="recent-item" onClick={() => selectSong(song)}>
                                                        <img src={song.cover} alt={song.title} className="recent-cover" />
                                                        <div className="recent-info">
                                                            <h4 className="recent-title">{song.title}</h4>
                                                            <p className="recent-artist">{song.artist} • {song.album}</p>
                                                        </div>
                                                        <span className="recent-duration">{song.duration}</span>
                                                        <button className="recent-play"><Play className="recent-play-icon" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div className="search-content">
                            <h2 className="page-title">Search Results</h2>
                            {loading ? (
                                <p>Loading...</p>
                            ) : error ? (
                                <p className="error-text">{error}</p>
                            ) : searchQuery ? (
                                <div className="search-results">
                                    {filteredSongs.map((song) => (
                                        <div key={song.id} className="search-item" onClick={() => selectSong(song)}>
                                            <img src={song.cover} alt={song.title} className="search-cover" />
                                            <div className="search-info">
                                                <h4 className="search-title">{song.title}</h4>
                                                <p className="search-artist">{song.artist} • {song.album}</p>
                                                <p className="search-genre">{song.genre}</p>
                                            </div>
                                            <div className="search-actions">
                                                <span className="search-duration">{song.duration}</span>
                                                <Heart className="heart-icon" />
                                                <button className="search-play"><Play className="search-play-icon" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-search">
                                    <Search className="empty-icon" />
                                    <p className="empty-text">Start typing to search for songs, artists, or albums</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'playlists' && (
                        <div className="playlists-content">
                            <div className="playlists-header">
                                <h2 className="page-title">My Playlists</h2>
                                <button onClick={() => setShowCreatePlaylist(true)} className="create-playlist-btn">
                                    <Plus className="plus-icon" /><span>Create Playlist</span>
                                </button>
                            </div>
                            {showCreatePlaylist && (
                                <div className="create-playlist-form">
                                    <h3 className="form-title">Create New Playlist</h3>
                                    <div className="form-controls">
                                        <input
                                            type="text"
                                            placeholder="Playlist name"
                                            value={newPlaylistName}
                                            onChange={(e) => setNewPlaylistName(e.target.value)}
                                            className="playlist-input"
                                        />
                                        <button onClick={createPlaylist} className="create-btn">Create</button>
                                        <button onClick={() => setShowCreatePlaylist(false)} className="cancel-btn">Cancel</button>
                                    </div>
                                </div>
                            )}
                            {loading ? (
                                <p>Loading...</p>
                            ) : error ? (
                                <p className="error-text">{error}</p>
                            ) : (
                                <div className="playlists-grid">
                                    {playlists.map((playlist) => (
                                        <div key={playlist.id} className="playlist-card">
                                            <img src={playlist.cover} alt={playlist.name} className="playlist-card-cover" />
                                            <h3 className="playlist-card-name">{playlist.name}</h3>
                                            <p className="playlist-card-count">{playlist.songs.length} songs</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'admin' && isAdmin && (
                        <div className="admin-content">
                            <h2 className="page-title">Admin Dashboard</h2>
                            <div className="stats-grid">
                                <div className="stat-card blue-gradient">
                                    <div className="stat-content">
                                        <div className="stat-info">
                                            <p className="stat-label">Total Songs</p>
                                            <p className="stat-value">{songs.length}</p>
                                        </div>
                                        <Music className="stat-icon" />
                                    </div>
                                </div>
                                <div className="stat-card green-gradient">
                                    <div className="stat-content">
                                        <div className="stat-info">
                                            <p className="stat-label">Active Users</p>
                                            <p className="stat-value">{users.length}</p>
                                        </div>
                                        <Users className="stat-icon" />
                                    </div>
                                </div>
                                <div className="stat-card orange-gradient">
                                    <div className="stat-content">
                                        <div className="stat-info">
                                            <p className="stat-label">Total Plays</p>
                                            <p className="stat-value">2.1M</p>
                                        </div>
                                        <TrendingUp className="stat-icon" />
                                    </div>
                                </div>
                                <div className="stat-card purple-gradient">
                                    <div className="stat-content">
                                        <div className="stat-info">
                                            <p className="stat-label">Playlists</p>
                                            <p className="stat-value">{playlists.length}</p>
                                        </div>
                                        <BarChart3 className="stat-icon" />
                                    </div>
                                </div>
                            </div>
                            <div className="admin-panel">
                                <h3 className="panel-title">User Management</h3>
                                <div className="user-list">
                                    {users.map((user) => (
                                        <div key={user.id} className="user-item">
                                            <div className="user-left">
                                                <div className="user-icon"><User className="user-icon-svg" /></div>
                                                <div className="user-details">
                                                    <p className="user-item-name">{user.name}</p>
                                                    <p className="user-email">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="user-right">
                                                <span className={`role-badge ${user.role}`}>{user.role}</span>
                                                <span className="join-date">{user.joinDate}</span>
                                                <button className="user-menu"><MoreVertical className="menu-icon" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="admin-panel">
                                <h3 className="panel-title">Songs Management</h3>
                                <div className="songs-list">
                                    {songs.map((song) => (
                                        <div key={song.id} className="admin-song-item">
                                            <img src={song.cover} alt={song.title} className="admin-song-cover" />
                                            <div className="admin-song-info">
                                                <h4 className="admin-song-title">{song.title}</h4>
                                                <p className="admin-song-artist">{song.artist} • {song.plays.toLocaleString()} plays</p>
                                            </div>
                                            <div className="admin-song-actions">
                                                <button className="edit-btn">Edit</button>
                                                <button className="delete-btn">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {currentSong && (
                <div className="music-player">
                    <div className="player-content">
                        <div className="player-left">
                            <img src={currentSong.cover} alt={currentSong.title} className="player-cover" />
                            <div className="player-info">
                                <h4 className="player-title">{currentSong.title}</h4>
                                <p className="player-artist">{currentSong.artist}</p>
                                {currentSong.preview_url && (
                                    <p className="player-note">30-second preview</p>
                                )}
                            </div>
                        </div>
                        <div className="player-controls">
                            <button className="control-btn"><Shuffle className="control-icon" /></button>
                            <button className="control-btn"><SkipBack className="control-icon" /></button>
                            <button onClick={togglePlay} className="play-btn">
                                {isPlaying ? <Pause className="play-icon" /> : <Play className="play-icon" />}
                            </button>
                            <button className="control-btn"><SkipForward className="control-icon" /></button>
                            <button className="control-btn"><Repeat className="control-icon" /></button>
                        </div>
                        <div className="player-right">
                            <Heart className="heart-btn" />
                            <div className="volume-controls">
                                <Volume2 className="volume-icon" />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={volume}
                                    onChange={(e) => setVolume(e.target.value)}
                                    className="volume-slider"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="progress-section">
                        {error && <p className="player-error">{error}</p>}
                        <div className="progress-time">
                            <span>{formatTime(currentTime)}</span>
                            <span>{currentSong.duration}</span>
                        </div>
                        <div className="progress-bar" onClick={handleSeek}>
                            <div className="progress-fill" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}