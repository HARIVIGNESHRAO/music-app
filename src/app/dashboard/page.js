'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Page() {
    const router = useRouter();
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
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [spotifyPlayer, setSpotifyPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('off');
    const [isLoadingSong, setIsLoadingSong] = useState(false);

    const searchTimerRef = useRef(null);
    const isLoadingRef = useRef(false);
    const profileLoadedRef = useRef(false);

    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';

    // Utility for API calls with exponential backoff
    const apiCallWithBackoff = async (requestFn, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await requestFn();
            } catch (err) {
                if (err.response?.status === 429) {
                    const retryAfter = parseInt(err.response.headers['retry-after'] || '10', 10) * 1000;
                    console.warn(`Rate limited. Retrying after ${retryAfter}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter + Math.random() * 100));
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Max retries reached for API call');
    };

    const generateCodeVerifier = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, Array.from(array)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const generateCodeChallenge = async (verifier) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const isSongPlayable = useCallback((song) => {
        return song && song.spotify_uri && isPremium && playerReady;
    }, [isPremium, playerReady]);

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            const mappedSongs = response.data.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || '',
                genre: 'Unknown',
                plays: track.popularity * 10000,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri,
            }));

            setSongs(mappedSongs);
            return mappedSongs;
        } catch (err) {
            console.error('Failed to fetch tracks:', err);
            setError('Failed to fetch tracks');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserPlaylists = useCallback(async (token) => {
        try {
            setLoading(true);
            const playlistsResponse = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/playlists?limit=10',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            const playlistsWithSongs = [];
            for (const playlist of playlistsResponse.data.items) {
                try {
                    const tracksResponse = await apiCallWithBackoff(() =>
                        axios.get(playlist.tracks.href)
                    );
                    const playlistSongs = tracksResponse.data.items
                        .filter(item => item.track)
                        .slice(0, 10)
                        .map(item => ({
                            id: item.track.id,
                            title: item.track.name,
                            artist: item.track.artists.map(a => a.name).join(', '),
                            album: item.track.album.name,
                            duration: new Date(item.track.duration_ms).toISOString().substr(14, 5),
                            cover: item.track.album.images[0]?.url || '',
                            genre: 'Unknown',
                            spotify_uri: item.track.uri,
                        }));
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: playlistSongs,
                        cover: playlist.images?.[0]?.url || '',
                    });
                } catch (err) {
                    console.error(`Error fetching tracks for playlist ${playlist.name}:`, err);
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: [],
                        cover: playlist.images?.[0]?.url || '',
                    });
                }
            }
            setPlaylists(playlistsWithSongs);
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
            setError('Failed to fetch playlists');
        } finally {
            setLoading(false);
        }
    }, []);

    const searchSongs = useCallback((query) => {
        if (!accessToken || !query) {
            setFilteredSongs([]);
            return;
        }

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        searchTimerRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                const response = await apiCallWithBackoff(() =>
                    axios.get(
                        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        }
                    )
                );
                const mappedSongs = response.data.tracks.items.map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                    cover: track.album.images[0]?.url || '',
                    genre: 'Unknown',
                    spotify_uri: track.uri,
                }));
                setFilteredSongs(mappedSongs);
            } catch (err) {
                console.error('Search failed:', err);
                setError('Search failed');
            } finally {
                setLoading(false);
            }
        }, 500);
    }, [accessToken]);

    const selectSong = useCallback((song, songList = null) => {
        if (isLoadingRef.current || !isSongPlayable(song)) {
            if (!isPremium || !playerReady) {
                setError('Spotify Premium required for playback');
            }
            return;
        }

        isLoadingRef.current = true;

        if (songList && songList.length > 0) {
            const validSongs = songList.filter(isSongPlayable);
            if (validSongs.length > 0) {
                const index = validSongs.findIndex(s => s.id === song.id);
                setQueue(validSongs);
                setCurrentIndex(index >= 0 ? index : 0);
            }
        } else {
            const availableSongs = filteredSongs.length > 0 ? filteredSongs : songs;
            const validSongs = availableSongs.filter(isSongPlayable);
            if (validSongs.length > 0) {
                const index = validSongs.findIndex(s => s.id === song.id);
                setQueue(validSongs);
                setCurrentIndex(index >= 0 ? index : 0);
            }
        }

        setCurrentSong(song);
        setIsPlaying(true);
        isLoadingRef.current = false;
    }, [songs, filteredSongs, isSongPlayable, isPremium, playerReady]);

    const playNext = useCallback(() => {
        setCurrentIndex(prevIndex => {
            const currentQueue = queue;
            if (currentQueue.length === 0) return prevIndex;

            let nextIndex;
            if (shuffle) {
                nextIndex = Math.floor(Math.random() * currentQueue.length);
            } else {
                nextIndex = prevIndex + 1;
                if (nextIndex >= currentQueue.length) {
                    if (repeat === 'all') {
                        nextIndex = 0;
                    } else {
                        setIsPlaying(false);
                        return prevIndex;
                    }
                }
            }

            const nextSong = currentQueue[nextIndex];
            if (nextSong) {
                selectSong(nextSong, currentQueue);
            }
            return nextIndex;
        });
    }, [queue, shuffle, repeat, selectSong, setIsPlaying]);

    const playPrevious = useCallback(() => {
        setCurrentIndex(prevIndex => {
            const currentQueue = queue;
            if (currentQueue.length === 0) return prevIndex;

            let newIndex = prevIndex - 1; // Use different variable name
            if (newIndex < 0) {
                newIndex = repeat === 'all' ? currentQueue.length - 1 : 0;
            }

            const prevSong = currentQueue[newIndex];
            if (prevSong) {
                selectSong(prevSong, currentQueue);
            }
            return newIndex;
        });
    }, [queue, repeat, selectSong]);

    const toggleShuffle = () => setShuffle(prev => !prev);
    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        setRepeat(prev => modes[(modes.indexOf(prev) + 1) % modes.length]);
    };

    const togglePlay = () => {
        if (!isPremium || !spotifyPlayer || !playerReady) {
            setError('Spotify Premium required');
            return;
        }
        if (isPlaying) {
            spotifyPlayer.pause();
        } else {
            spotifyPlayer.resume();
        }
    };

    const handleSpotifyLogin = async () => {
        const codeVerifier = generateCodeVerifier();
        window.localStorage.setItem('spotify_code_verifier', codeVerifier);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=${RESPONSE_TYPE}&code_challenge=${codeChallenge}&code_challenge_method=${CODE_CHALLENGE_METHOD}`;
        window.location.href = authUrl;
    };

    const fetchUserProfile = useCallback(async (token) => {
        try {
            setLoading(true);
            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = {
                id: data.id,
                name: data.display_name,
                email: data.email,
                avatar: data.images?.[0]?.url || '',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsPremium(user.product === 'premium');
            setAccessToken(token);
            window.localStorage.setItem('spotify_token', token);
            window.localStorage.setItem('user', JSON.stringify(user));
            profileLoadedRef.current = true;
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError('Failed to fetch profile');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSpotifyData = useCallback(() => {
        if (!accessToken) {
            setError('No access token');
            return;
        }
        fetchTopTracks(accessToken);
        fetchUserPlaylists(accessToken);
    }, [accessToken, fetchTopTracks, fetchUserPlaylists]);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const openPlaylist = (playlist) => {
        setSelectedPlaylist(playlist);
        setActiveTab('playlist-detail');
        const validSongs = playlist.songs.filter(isSongPlayable);
        if (validSongs.length > 0) {
            setQueue(validSongs);
            setCurrentIndex(0);
            selectSong(validSongs[0], validSongs);
        }
    };

    const handleLogout = () => {
        setAccessToken(null);
        setCurrentUser(null);
        setSongs([]);
        setPlaylists([]);
        setCurrentSong(null);
        setIsPlaying(false);
        setQueue([]);
        setCurrentIndex(0);
        profileLoadedRef.current = false;
        window.localStorage.clear();
        router.push('/login');
    };

    // Handle Spotify OAuth callback
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            // In production, send code to backend to exchange for token
            // For now, clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            setError('Please implement token exchange with your backend');
        }

        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken && !profileLoadedRef.current) {
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile]);

    // Initialize Spotify Player
    useEffect(() => {
        if (!accessToken || !isPremium) return;

        const initializePlayer = () => {
            if (window.Spotify) {
                const player = new window.Spotify.Player({
                    name: 'MusicStream',
                    getOAuthToken: cb => cb(accessToken),
                    volume: volume / 100
                });

                player.addListener('ready', ({ device_id }) => {
                    setDeviceId(device_id);
                    setSpotifyPlayer(player);
                    setPlayerReady(true);
                });

                player.addListener('player_state_changed', (state) => {
                    if (state) {
                        setIsPlaying(!state.paused);
                        setCurrentTime(state.position / 1000);
                        setDuration(state.duration / 1000);
                        if (state.track_window.current_track) {
                            setCurrentSong({
                                id: state.track_window.current_track.id,
                                title: state.track_window.current_track.name,
                                artist: state.track_window.current_track.artists.map(a => a.name).join(', '),
                                spotify_uri: state.track_window.current_track.uri
                            });
                        }
                    }
                });

                player.connect();
            }
        };

        if (!window.Spotify) {
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
        } else {
            initializePlayer();
        }

        return () => {
            if (spotifyPlayer) {
                spotifyPlayer.disconnect();
            }
        };
    }, [accessToken, isPremium]);

    useEffect(() => {
        if (spotifyPlayer) {
            spotifyPlayer.setVolume(volume / 100);
        }
    }, [volume, spotifyPlayer]);

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
                        <button onClick={handleSpotifyLogin} className="login-btn spotify-btn">
                            Login with Spotify
                        </button>
                        <Link href="/login?type=user">
                            <button className="login-btn user-btn">Login as User</button>
                        </Link>
                        <Link href="/login?type=admin">
                            <button className="login-btn admin-btn">Login as Admin</button>
                        </Link>
                    </div>
                    {loading && <p>Loading...</p>}
                    {error && <p className="error-text">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-left">
                    <Music className="header-logo" />
                    <h1>MusicStream</h1>
                </div>
                <div className="header-center">
                    <div className="search-container">
                        <Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                searchSongs(e.target.value);
                            }}
                            className="search-input"
                        />
                    </div>
                </div>
                <div className="header-right">
                    <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar" />
                    <span>{currentUser.name} {isPremium ? '(Premium)' : '(Free)'}</span>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <div className="main-layout">
                <aside className="sidebar">
                    <nav className="nav-menu">
                        <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'nav-item active' : 'nav-item'}>
                            <Home /><span>Home</span>
                        </button>
                        <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'nav-item active' : 'nav-item'}>
                            <Search /><span>Search</span>
                        </button>
                        <button onClick={() => setActiveTab('playlists')} className={activeTab === 'playlists' ? 'nav-item active' : 'nav-item'}>
                            <Music /><span>Playlists</span>
                        </button>
                    </nav>
                </aside>

                <main className="main-content">
                    {activeTab === 'home' && (
                        <div className="home-content">
                            <h2>Welcome, {currentUser.name}!</h2>
                            {loading ? (
                                <p>Loading...</p>
                            ) : (
                                <>
                                    <button onClick={loadSpotifyData} disabled={loading}>
                                        Load Spotify Data
                                    </button>
                                    {songs.length > 0 ? (
                                        songs.map(song => (
                                            <div key={song.id} className="song-card" onClick={() => selectSong(song)}>
                                                <Image src={song.cover} alt={song.title} width={64} height={64} />
                                                <div>
                                                    <h3>{song.title}</h3>
                                                    <p>{song.artist}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p>Click to load your Spotify top tracks</p>
                                    )}
                                </>
                            )}
                            {error && <p className="error-text">{error}</p>}
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div>
                            <h2>Search</h2>
                            {filteredSongs.map(song => (
                                <div key={song.id} onClick={() => selectSong(song)}>
                                    <Image src={song.cover} alt={song.title} width={64} height={64} />
                                    <div>
                                        <h3>{song.title}</h3>
                                        <p>{song.artist}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'playlists' && (
                        <div>
                            <h2>Playlists</h2>
                            {playlists.map(playlist => (
                                <div key={playlist.id} onClick={() => openPlaylist(playlist)}>
                                    <Image src={playlist.cover} alt={playlist.name} width={64} height={64} />
                                    <div>
                                        <h3>{playlist.name}</h3>
                                        <p>{playlist.songs.length} songs</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {currentSong && isPremium && playerReady && (
                <div className="music-player">
                    <div className="player-content">
                        <div>
                            <Image src={currentSong.cover} alt={currentSong.title} width={64} height={64} />
                            <div>
                                <h4>{currentSong.title}</h4>
                                <p>{currentSong.artist}</p>
                            </div>
                        </div>
                        <div className="player-controls">
                            <button onClick={toggleShuffle}>{shuffle ? '🔀' : '🔁'}</button>
                            <button onClick={playPrevious}><SkipBack size={16} /></button>
                            <button onClick={togglePlay} className="play-btn">
                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <button onClick={playNext}><SkipForward size={16} /></button>
                            <button onClick={toggleRepeat}>🔂</button>
                        </div>
                        <div>
                            <Volume2 size={16} />
                            <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(e.target.value)} />
                        </div>
                    </div>
                    <div className="progress-section">
                        <span>{formatTime(currentTime)}</span>
                        <div className="progress-bar" style={{ width: '100%' }}>
                            <div
                                className="progress-fill"
                                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                            />
                        </div>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}