'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, Users, BarChart3, Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Utility to debounce functions
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

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
    const [filterGenre, setFilterGenre] = useState('all');
    const [filterArtist, setFilterArtist] = useState('all');
    const [recommendations, setRecommendations] = useState([]);
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
    const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
    const [likedSongs, setLikedSongs] = useState(new Set());
    const [recentlyPlayed, setRecentlyPlayed] = useState([]);
    const [isPremium, setIsPremium] = useState(false);
    const [spotifyPlayer, setSpotifyPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const searchTimerRef = useRef(null);
    const isLoadingRef = useRef(false);
    const profileLoadedRef = useRef(false);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('off');
    const [isLoadingSong, setIsLoadingSong] = useState(false);
    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';

    const CACHE_KEY_TOP_TRACKS = 'spotify_top_tracks';
    const CACHE_KEY_PLAYLISTS = 'spotify_playlists';
    const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

    // Utility for API calls with exponential backoff
    const apiCallWithBackoff = async (requestFn, maxRetries = 3) => {
        let apiCallCount = JSON.parse(window.localStorage.getItem('apiCallCount') || '0') + 1;
        window.localStorage.setItem('apiCallCount', apiCallCount);
        console.log(`API call #${apiCallCount}: ${requestFn.toString().slice(0, 50)}...`);

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

    // Cache utilities
    const getCachedData = (key) => {
        const cached = window.localStorage.getItem(key);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
                return data;
            }
        }
        return null;
    };

    const setCachedData = (key, data) => {
        window.localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
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

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedTracks = getCachedData(CACHE_KEY_TOP_TRACKS);
            if (cachedTracks) {
                setSongs(cachedTracks);
                return cachedTracks;
            }

            const response = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50&fields=items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity)',
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
            setCachedData(CACHE_KEY_TOP_TRACKS, mappedSongs);
            return mappedSongs;
        } catch (err) {
            console.error('Failed to fetch tracks:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to fetch tracks');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserPlaylists = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedPlaylists = getCachedData(CACHE_KEY_PLAYLISTS);
            if (cachedPlaylists) {
                setPlaylists(cachedPlaylists);
                return;
            }

            const playlistsResponse = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/playlists?limit=20&fields=items(id,name,tracks.href,images)',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            const playlistsWithSongs = [];
            const MAX_PLAYLISTS = 10;
            for (const playlist of playlistsResponse.data.items.slice(0, MAX_PLAYLISTS)) {
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    const tracksResponse = await apiCallWithBackoff(() =>
                        axios.get(
                            `${playlist.tracks.href}?fields=items(track(id,name,artists(name),album(name,images),duration_ms,preview_url,uri))`,
                            {
                                headers: { Authorization: `Bearer ${token}` },
                            }
                        )
                    );
                    const playlistSongs = tracksResponse.data.items
                        .filter(item => item.track && item.track.id)
                        .map(item => ({
                            id: item.track.id,
                            title: item.track.name,
                            artist: item.track.artists.map(a => a.name).join(', '),
                            album: item.track.album.name,
                            duration: new Date(item.track.duration_ms).toISOString().substr(14, 5),
                            cover: item.track.album.images[0]?.url || '',
                            genre: 'Unknown',
                            plays: 0,
                            preview_url: item.track.preview_url || null,
                            spotify_uri: item.track.uri,
                        }));
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: playlistSongs,
                        cover:
                            playlist.images?.[0]?.url ||
                            playlistSongs[0]?.cover ||
                            '',
                    });
                } catch (err) {
                    console.error(`Error fetching tracks for playlist ${playlist.name}:`, err);
                    if (err.response?.status === 429) continue;
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: [],
                        cover: playlist.images?.[0]?.url || '',
                    });
                }
            }
            setPlaylists(playlistsWithSongs);
            setCachedData(CACHE_KEY_PLAYLISTS, playlistsWithSongs);
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to fetch playlists');
        } finally {
            setLoading(false);
        }
    }, []);

    const searchSongs = useCallback(async (query) => {
        if (!accessToken || !query) {
            setFilteredSongs([]);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await apiCallWithBackoff(() =>
                    axios.get(
                        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20&fields=tracks(items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity))`,
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
                    plays: track.popularity * 10000,
                    preview_url: track.preview_url || null,
                    spotify_uri: track.uri,
                }));
                setFilteredSongs(mappedSongs);
            } catch (err) {
                console.error('Search failed:', err);
                setError(err.response?.status === 429 ? 'Too many searches. Please wait a moment.' : 'Search failed');
            } finally {
                setLoading(false);
            }
        }, 800);
    }, [accessToken]);

    const createPlaylist = async () => {
        if (!newPlaylistName.trim() || !accessToken || !currentUser?.id) {
            setError('Cannot create playlist without Spotify connection');
            return;
        }

        try {
            const { data } = await apiCallWithBackoff(() =>
                axios.post(
                    `https://api.spotify.com/v1/users/${currentUser.id}/playlists`,
                    { name: newPlaylistName, public: true },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                )
            );
            setPlaylists(prev => [...prev, {
                id: data.id,
                name: data.name,
                songs: [],
                cover: data.images?.[0]?.url || ''
            }]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
            setError(null);
        } catch (err) {
            console.error('Failed to create playlist:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to create playlist');
        }
    };

    const isSongPlayable = useCallback((song) => {
        return song && song.spotify_uri && isPremium && playerReady;
    }, [isPremium, playerReady]);

    const selectSong = useCallback(async (song, songList = null) => {
        if (isLoadingRef.current) return;
        if (!isSongPlayable(song)) {
            setError(`Spotify Premium required to play ${song.title}`);
            setCurrentSong(song);
            setIsPlaying(false);
            return;
        }

        isLoadingRef.current = true;

        setQueue((prevQueue) => {
            if (songList && songList.length > 0) {
                const validSongs = songList.filter(isSongPlayable);
                if (validSongs.length === 0) {
                    setError("No playable songs in the provided list");
                    isLoadingRef.current = false;
                    return prevQueue;
                }
                const index = validSongs.findIndex((s) => s.id === song.id);
                setCurrentIndex(index >= 0 ? index : 0);
                return validSongs;
            }
            return prevQueue;
        });

        setCurrentSong(song);
        setIsPlaying(true);
        setError(null);

        setTimeout(() => {
            isLoadingRef.current = false;
        }, 500);
    }, [isSongPlayable]);

    const playNext = useCallback(() => {
        setQueue(currentQueue => {
            if (currentQueue.length === 0) return currentQueue;

            setCurrentIndex(prevIndex => {
                let nextIndex = prevIndex + 1;
                if (nextIndex >= currentQueue.length) {
                    if (repeat === 'all') {
                        nextIndex = 0;
                    } else {
                        setIsPlaying(false);
                        return prevIndex;
                    }
                }
                selectSong(currentQueue[nextIndex]);
                return nextIndex;
            });
            return currentQueue;
        });
    }, [repeat, selectSong]);

    const playPrevious = useCallback(() => {
        if (queue.length === 0) return;
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            if (repeat === 'all') {
                prevIndex = queue.length - 1;
            } else {
                prevIndex = 0;
            }
        }
        setCurrentIndex(prevIndex);
        selectSong(queue[prevIndex]);
    }, [queue, currentIndex, repeat, selectSong]);

    const fetchUserProfile = useCallback(async (token) => {
        if (profileLoadedRef.current) return;

        try {
            setLoading(true);
            setError(null);

            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = {
                id: data.id,
                name: data.display_name,
                email: data.email,
                avatar: data.images?.[0]?.url || '',
                role: data.email === 'admin@music.com' ? 'admin' : 'user',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsAdmin(user.role === 'admin');
            setIsPremium(user.product === 'premium');
            window.localStorage.setItem('user', JSON.stringify(user));
            profileLoadedRef.current = true;
            setAccessToken(token);

        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(`Failed to fetch profile: ${err.response?.data?.error?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSpotifyData = useCallback(async () => {
        if (!accessToken) return;

        setLoading(true);
        setError(null);

        try {
            await fetchTopTracks(accessToken);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchUserPlaylists(accessToken);
        } catch (err) {
            console.error('Failed to load Spotify data:', err);
            setError('Failed to load Spotify data');
        } finally {
            setLoading(false);
        }
    }, [accessToken, fetchTopTracks, fetchUserPlaylists]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            // Handle Spotify callback
            const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
            if (codeVerifier) {
                // Exchange code for token (you'll need to implement this with your backend)
                // For now, assume token is received
                const token = 'your-access-token'; // Replace with actual token exchange
                fetchUserProfile(token);
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken && !profileLoadedRef.current) {
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile]);

    useEffect(() => {
        if (!accessToken || !isPremium) return;

        let playerInstance = null;

        const initializePlayer = () => {
            if (window.Spotify) {
                playerInstance = new window.Spotify.Player({
                    name: 'MusicStream Web Player',
                    getOAuthToken: cb => { cb(accessToken); },
                    volume: volume / 100
                });

                playerInstance.addListener('ready', ({ device_id }) => {
                    console.log('Spotify Player ready with Device ID', device_id);
                    setDeviceId(device_id);
                    setSpotifyPlayer(playerInstance);
                    setPlayerReady(true);
                });

                playerInstance.addListener('player_state_changed', (state) => {
                    if (!state) return;
                    setIsPlaying(!state.paused);
                    setCurrentTime(state.position / 1000);
                    setDuration(state.duration / 1000);

                    if (state.track_window.current_track) {
                        const track = state.track_window.current_track;
                        const newSong = {
                            id: track.id,
                            title: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            album: track.album.name,
                            duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                            cover: track.album.images[0]?.url || '',
                            genre: 'Unknown',
                            spotify_uri: track.uri
                        };
                        setCurrentSong(newSong);
                    }
                });

                playerInstance.connect();
            }
        };

        if (!window.Spotify) {
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            document.body.appendChild(script);
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
        } else {
            initializePlayer();
        }

        return () => {
            if (playerInstance) playerInstance.disconnect();
        };
    }, [accessToken, isPremium, volume]);

    useEffect(() => {
        if (spotifyPlayer) {
            spotifyPlayer.setVolume(volume / 100);
        }
    }, [volume, spotifyPlayer]);

    useEffect(() => {
        if (!currentSong || !isPremium || !playerReady || !deviceId) return;

        const playSong = async () => {
            if (isLoadingRef.current) return;
            isLoadingRef.current = true;

            try {
                setIsLoadingSong(true);
                await apiCallWithBackoff(() =>
                    axios.put(
                        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                        { uris: [currentSong.spotify_uri] },
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    )
                );
            } catch (err) {
                setError(`Failed to play: ${err.message}`);
                setIsPlaying(false);
            } finally {
                setIsLoadingSong(false);
                isLoadingRef.current = false;
            }
        };

        playSong();
    }, [currentSong, deviceId, accessToken, isPremium, playerReady]);

    const handleSpotifyLogin = async () => {
        const codeVerifier = generateCodeVerifier();
        window.localStorage.setItem('spotify_code_verifier', codeVerifier);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=${RESPONSE_TYPE}&code_challenge=${codeChallenge}&code_challenge_method=${CODE_CHALLENGE_METHOD}`;
        window.location.href = authUrl;
    };

    const togglePlay = () => {
        if (isPremium && spotifyPlayer && playerReady) {
            if (isPlaying) {
                spotifyPlayer.pause();
            } else {
                spotifyPlayer.resume();
            }
        }
    };

    const handleLogout = () => {
        // Clear all state and localStorage
        setAccessToken(null);
        setCurrentUser(null);
        setSongs([]);
        setPlaylists([]);
        setCurrentSong(null);
        setIsPlaying(false);
        profileLoadedRef.current = false;
        window.localStorage.clear();
        router.push('/login');
    };

    if (!currentUser) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="logo-container">
                            <Music className="logo-icon" />
                        </div>
                        <h1 className="app-title">MusicStream</h1>
                        <p className="app-subtitle">Connect your Spotify account</p>
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
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    searchSongs(e.target.value);
                                }}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <div className="header-right">
                        <Image
                            src={currentUser.avatar}
                            alt={currentUser.name}
                            className="user-avatar"
                            width={100}
                            height={100}
                        />
                        <span className="user-name">{currentUser.name} {isPremium ? '(Premium)' : '(Free)'}</span>
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
                    </nav>
                </aside>

                <main className="main-content">
                    {activeTab === 'home' && (
                        <div className="home-content">
                            <div className="welcome-section">
                                <h2>Welcome back, {currentUser.name}!</h2>
                                {loading ? (
                                    <p>Loading your Spotify library...</p>
                                ) : error ? (
                                    <p className="error-text">{error}</p>
                                ) : (
                                    <>
                                        <button onClick={loadSpotifyData} disabled={loading} className="spotify-load-btn">
                                            {loading ? 'Loading...' : '🔄 Refresh Spotify Data'}
                                        </button>
                                        {songs.length > 0 ? (
                                            <div className="songs-grid">
                                                {songs.map((song) => (
                                                    <div key={song.id} className="song-card" onClick={() => selectSong(song)}>
                                                        <Image src={song.cover} alt={song.title} width={300} height={300} />
                                                        <h3>{song.title}</h3>
                                                        <p>{song.artist}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p>Click "Refresh Spotify Data" to load your top tracks</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div className="search-content">
                            <h2>Search Results</h2>
                            {loading ? (
                                <p>Searching...</p>
                            ) : filteredSongs.length > 0 ? (
                                <div className="search-results">
                                    {filteredSongs.map((song) => (
                                        <div key={song.id} className="search-item" onClick={() => selectSong(song)}>
                                            <Image src={song.cover} alt={song.title} width={300} height={300} />
                                            <div>
                                                <h4>{song.title}</h4>
                                                <p>{song.artist}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No results found</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'playlists' && (
                        <div className="playlists-content">
                            <h2>My Playlists</h2>
                            {loading ? (
                                <p>Loading playlists...</p>
                            ) : playlists.length > 0 ? (
                                <div className="playlists-grid">
                                    {playlists.map((playlist) => (
                                        <div key={playlist.id} className="playlist-card" onClick={() => openPlaylist(playlist)}>
                                            <Image src={playlist.cover} alt={playlist.name} width={300} height={300} />
                                            <h3>{playlist.name}</h3>
                                            <p>{playlist.songs.length} songs</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No playlists found. Load your Spotify data first.</p>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {currentSong && isPremium && playerReady && (
                <div className="music-player">
                    <div className="player-content">
                        <div className="player-left">
                            <Image src={currentSong.cover} alt={currentSong.title} width={300} height={300} />
                            <div>
                                <h4>{currentSong.title}</h4>
                                <p>{currentSong.artist}</p>
                            </div>
                        </div>
                        <div className="player-controls">
                            <button onClick={playPrevious}><SkipBack /></button>
                            <button onClick={togglePlay} className="play-btn">
                                {isPlaying ? <Pause /> : <Play />}
                            </button>
                            <button onClick={playNext}><SkipForward /></button>
                        </div>
                        <div className="player-right">
                            <Volume2 />
                            <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(e.target.value)} />
                        </div>
                    </div>
                    <div className="progress-section">
                        <span>{formatTime(currentTime)}</span>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                        </div>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}