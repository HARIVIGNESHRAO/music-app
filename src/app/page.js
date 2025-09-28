'use client';

import React, { useState, useRef, useEffect } from 'react';
import './page.css';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    Heart,
    Search,
    Home,
    Music,
    User,
    Settings,
    Plus,
    Shuffle,
    Repeat,
    MoreVertical,
    Clock,
    TrendingUp,
    Users,
    BarChart3,
    Shield
} from 'lucide-react';

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
    const audioRef = useRef(null);

    // Sample music data
    const [songs] = useState([
        {
            id: 1,
            title: "Midnight Dreams",
            artist: "Luna Martinez",
            album: "Nocturnal Vibes",
            duration: "3:24",
            cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center",
            genre: "Pop",
            plays: 1234567
        },
        {
            id: 2,
            title: "Electric Pulse",
            artist: "Neon Collective",
            album: "Digital Horizons",
            duration: "4:12",
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop&crop=center",
            genre: "Electronic",
            plays: 987654
        },
        {
            id: 3,
            title: "Acoustic Soul",
            artist: "River Stone",
            album: "Unplugged Sessions",
            duration: "2:58",
            cover: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=300&h=300&fit=crop&crop=center",
            genre: "Acoustic",
            plays: 756432
        },
        {
            id: 4,
            title: "Urban Rhythm",
            artist: "City Beats",
            album: "Street Anthology",
            duration: "3:45",
            cover: "https://images.unsplash.com/photo-1571974599782-87613f249808?w=300&h=300&fit=crop&crop=center",
            genre: "Hip-Hop",
            plays: 2143567
        },
        {
            id: 5,
            title: "Sunset Boulevard",
            artist: "Golden Hour",
            album: "California Dreams",
            duration: "4:33",
            cover: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop&crop=center",
            genre: "Rock",
            plays: 654321
        }
    ]);

    const [users] = useState([
        { id: 1, name: "Alex Johnson", email: "alex@music.com", role: "user", joinDate: "2024-01-15" },
        { id: 2, name: "Sarah Chen", email: "sarah@music.com", role: "user", joinDate: "2024-02-20" },
        { id: 3, name: "Mike Wilson", email: "mike@music.com", role: "admin", joinDate: "2023-12-01" }
    ]);

    useEffect(() => {
        // Initialize with a sample user
        setCurrentUser({
            id: 1,
            name: "Alex Johnson",
            email: "alex@music.com",
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center"
        });

        // Initialize playlists
        setPlaylists([
            {
                id: 1,
                name: "My Favorites",
                songs: [songs[0], songs[2]],
                cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center"
            },
            {
                id: 2,
                name: "Workout Mix",
                songs: [songs[1], songs[3]],
                cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop&crop=center"
            }
        ]);
    }, []);

    // Authentication functions
    const handleLogin = (email, password, role = 'user') => {
        const user = {
            id: 1,
            name: role === 'admin' ? "Admin User" : "Demo User",
            email: email,
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center"
        };
        setCurrentUser(user);
        setIsAdmin(role === 'admin');
        setActiveTab('home');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setIsAdmin(false);
        setCurrentSong(null);
        setIsPlaying(false);
        setActiveTab('home');
    };

    // Music player functions
    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const selectSong = (song) => {
        setCurrentSong(song);
        setIsPlaying(true);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Playlist functions
    const createPlaylist = () => {
        if (newPlaylistName.trim()) {
            const newPlaylist = {
                id: playlists.length + 1,
                name: newPlaylistName,
                songs: [],
                cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center"
            };
            setPlaylists([...playlists, newPlaylist]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
        }
    };

    const filteredSongs = songs.filter(song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.album.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Login Component
    if (!currentUser) {
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
                        <button
                            onClick={() => handleLogin("demo@music.com", "password", "user")}
                            className="login-btn user-btn"
                        >
                            Login as User
                        </button>
                        <button
                            onClick={() => handleLogin("admin@music.com", "password", "admin")}
                            className="login-btn admin-btn"
                        >
                            Login as Admin
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main App Component
    return (
        <div className="app-container">
            {/* Header */}
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
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    <div className="header-right">
                        <img
                            src={currentUser.avatar}
                            alt={currentUser.name}
                            className="user-avatar"
                        />
                        <span className="user-name">{currentUser.name}</span>
                        <button onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="main-layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    <nav className="nav-menu">
                        <button
                            onClick={() => setActiveTab('home')}
                            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
                        >
                            <Home className="nav-icon" />
                            <span>Home</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('search')}
                            className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
                        >
                            <Search className="nav-icon" />
                            <span>Search</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('playlists')}
                            className={`nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
                        >
                            <Music className="nav-icon" />
                            <span>My Playlists</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`nav-item ${activeTab === 'admin' ? 'active admin' : ''}`}
                            >
                                <Shield className="nav-icon" />
                                <span>Admin Panel</span>
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

                {/* Main Content */}
                <main className="main-content">
                    {activeTab === 'home' && (
                        <div className="home-content">
                            <div className="welcome-section">
                                <h2 className="welcome-title">Welcome back, {currentUser.name}!</h2>

                                <div className="featured-songs">
                                    {songs.slice(0, 5).map((song) => (
                                        <div
                                            key={song.id}
                                            className="song-card"
                                            onClick={() => selectSong(song)}
                                        >
                                            <div className="song-cover-container">
                                                <img src={song.cover} alt={song.title} className="song-cover" />
                                                <button className="play-overlay">
                                                    <Play className="play-icon" />
                                                </button>
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
                                            <div
                                                key={song.id}
                                                className="recent-item"
                                                onClick={() => selectSong(song)}
                                            >
                                                <img src={song.cover} alt={song.title} className="recent-cover" />
                                                <div className="recent-info">
                                                    <h4 className="recent-title">{song.title}</h4>
                                                    <p className="recent-artist">{song.artist} • {song.album}</p>
                                                </div>
                                                <span className="recent-duration">{song.duration}</span>
                                                <button className="recent-play">
                                                    <Play className="recent-play-icon" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div className="search-content">
                            <h2 className="page-title">Search Results</h2>
                            {searchQuery ? (
                                <div className="search-results">
                                    {filteredSongs.map((song) => (
                                        <div
                                            key={song.id}
                                            className="search-item"
                                            onClick={() => selectSong(song)}
                                        >
                                            <img src={song.cover} alt={song.title} className="search-cover" />
                                            <div className="search-info">
                                                <h4 className="search-title">{song.title}</h4>
                                                <p className="search-artist">{song.artist} • {song.album}</p>
                                                <p className="search-genre">{song.genre}</p>
                                            </div>
                                            <div className="search-actions">
                                                <span className="search-duration">{song.duration}</span>
                                                <Heart className="heart-icon" />
                                                <button className="search-play">
                                                    <Play className="search-play-icon" />
                                                </button>
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
                                <button
                                    onClick={() => setShowCreatePlaylist(true)}
                                    className="create-playlist-btn"
                                >
                                    <Plus className="plus-icon" />
                                    <span>Create Playlist</span>
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
                                        <button onClick={createPlaylist} className="create-btn">
                                            Create
                                        </button>
                                        <button
                                            onClick={() => setShowCreatePlaylist(false)}
                                            className="cancel-btn"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="playlists-grid">
                                {playlists.map((playlist) => (
                                    <div key={playlist.id} className="playlist-card">
                                        <img src={playlist.cover} alt={playlist.name} className="playlist-card-cover" />
                                        <h3 className="playlist-card-name">{playlist.name}</h3>
                                        <p className="playlist-card-count">{playlist.songs.length} songs</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin' && isAdmin && (
                        <div className="admin-content">
                            <h2 className="page-title">Admin Dashboard</h2>

                            {/* Stats Cards */}
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

                            {/* User Management */}
                            <div className="admin-panel">
                                <h3 className="panel-title">User Management</h3>
                                <div className="user-list">
                                    {users.map((user) => (
                                        <div key={user.id} className="user-item">
                                            <div className="user-left">
                                                <div className="user-icon">
                                                    <User className="user-icon-svg" />
                                                </div>
                                                <div className="user-details">
                                                    <p className="user-item-name">{user.name}</p>
                                                    <p className="user-email">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="user-right">
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                                                <span className="join-date">{user.joinDate}</span>
                                                <button className="user-menu">
                                                    <MoreVertical className="menu-icon" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Songs Management */}
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

            {/* Music Player */}
            {currentSong && (
                <div className="music-player">
                    <div className="player-content">
                        <div className="player-left">
                            <img src={currentSong.cover} alt={currentSong.title} className="player-cover" />
                            <div className="player-info">
                                <h4 className="player-title">{currentSong.title}</h4>
                                <p className="player-artist">{currentSong.artist}</p>
                            </div>
                        </div>

                        <div className="player-controls">
                            <button className="control-btn">
                                <Shuffle className="control-icon" />
                            </button>
                            <button className="control-btn">
                                <SkipBack className="control-icon" />
                            </button>
                            <button onClick={togglePlay} className="play-btn">
                                {isPlaying ? <Pause className="play-icon" /> : <Play className="play-icon" />}
                            </button>
                            <button className="control-btn">
                                <SkipForward className="control-icon" />
                            </button>
                            <button className="control-btn">
                                <Repeat className="control-icon" />
                            </button>
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
                        <div className="progress-time">
                            <span>0:00</span>
                            <span>{currentSong.duration}</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: '30%' }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}