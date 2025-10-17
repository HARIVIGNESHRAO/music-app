'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';import axios from 'axios';import Image from 'next/image';import Link from 'next/link';import './page.css';import {    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,    Plus, Shuffle, Repeat} from 'lucide-react';import { useRouter } from 'next/navigation';
// Utility to debounce functionsconst debounce = (func, wait) => {    let timeout;    return (...args) => {        clearTimeout(timeout);        timeout = setTimeout(() => func(...args), wait);    };};
export default function Page() {    const router = useRouter();    const [currentUser, setCurrentUser] = useState(null);    const [isPlaying, setIsPlaying] = useState(false);    const [currentSong, setCurrentSong] = useState(null);    const [currentTime, setCurrentTime] = useState(0);    const [duration, setDuration] = useState(0);    const [volume, setVolume] = useState(70);    const [activeTab, setActiveTab] = useState('home');    const [searchQuery, setSearchQuery] = useState('');    const [playlists, setPlaylists] = useState([]);    const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);    const [newPlaylistName, setNewPlaylistName] = useState('');    const [songs, setSongs] = useState([]);    const [filteredSongs, setFilteredSongs] = useState([]);    const [accessToken, setAccessToken] = useState(null);    const [loading, setLoading] = useState(false);    const [error, setError] = useState(null);    const [selectedPlaylist, setSelectedPlaylist] = useState(null);    const [filterGenre, setFilterGenre] = useState('all');    const [filterArtist, setFilterArtist] = useState('all');    const [recommendations, setRecommendations] = useState([]);    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);    const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);    const [artists, setArtists] = useState([]);    const audioRef = useRef(null);    const [queue, setQueue] = useState([]);    const [currentIndex, setCurrentIndex] = useState(0);    const [shuffle, setShuffle] = useState(false);    const [repeat, setRepeat] = useState('off');    const [isLoadingSong, setIsLoadingSong] = useState(false);    const [likedSongs, setLikedSongs] = useState(new Set());    const [recentlyPlayed, setRecentlyPlayed] = useState([]);    const [isPremium, setIsPremium] = useState(false);    const [spotifyPlayer, setSpotifyPlayer] = useState(null);    const [deviceId, setDeviceId] = useState(null);    const [playerReady, setPlayerReady] = useState(false);    const searchTimerRef = useRef(null);    const isLoadingRef = useRef(false);    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';    const RESPONSE_TYPE = 'code';    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';    const CODE_CHALLENGE_METHOD = 'S256';
    const CACHE_KEY_TOP_TRACKS = 'spotify_top_tracks';
    const CACHE_KEY_PLAYLISTS = 'spotify_playlists';
    const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
    const profileLoadedRef = useRef(false);

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
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, Array.from(array)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const generateCodeChallenge = async (verifier) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const generateRecommendations = useCallback(() => {
        if (recentlyPlayed.length === 0) {
            setRecommendations([]);
            return;
        }

        const allGenres = [...new Set(songs.map(song => song.genre))];
        const allArtists = [...new Set(songs.map(song => song.artist))];

        const createFeatureVector = (song) => {
            const genreVector = allGenres.map(genre => song.genre === genre ? 1 : 0);
            const artistVector = allArtists.map(artist => song.artist === artist ? 1 : 0);
            const maxPlays = Math.max(...songs.map(s => s.plays || 1), 1);
            const plays = song.plays ? song.plays / maxPlays : 0;
            return [...genreVector, ...artistVector, plays];
        };

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
        };

        const songVectors = songs.map(song => ({
            song,
            vector: createFeatureVector(song)
        }));

        const userVectors = recentlyPlayed.map(song => createFeatureVector(song));
        const userVector = userVectors.reduce(
            (avg, vec) => avg.map((val, i) => val + vec[i] / userVectors.length),
            new Array(allGenres.length + allArtists.length + 1).fill(0)
        );

        const scores = songVectors.map(({ song, vector }) => ({
            song,
            score: cosineSimilarity(userVector, vector)
        }));

        const recommendedSongs = scores
            .sort((a, b) => b.score - a.score)
            .map(item => item.song)
            .filter(song => !recentlyPlayed.some(s => s.id === song.id))
            .slice(0, 4);

        setRecommendations(recommendedSongs);
    }, [recentlyPlayed, songs]);

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedTracks = getCachedData(CACHE_KEY_TOP_TRACKS);
            if (cachedTracks) {
                setSongs(cachedTracks);
                generateRecommendations();
                return cachedTracks;
            }

            const response = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=10&fields=items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity)',
                    { headers: { Authorization: `Bearer ${token}` } }
                )
            );

            const mappedSongs = response.data.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || 'https://via.placeholder.com/300',
                genre: 'Unknown',
                plays: track.popularity * 10000,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri
            }));

            setSongs(mappedSongs);
            setCachedData(CACHE_KEY_TOP_TRACKS, mappedSongs);
            generateRecommendations();
            return mappedSongs;
        } catch (err) {
            console.error('Failed to fetch tracks:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait.' : 'Failed to fetch tracks');
            return [];
        } finally {
            setLoading(false);
        }
    }, [generateRecommendations]);

    const fetchUserPlaylists = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedPlaylists = getCachedData(CACHE_KEY_PLAYLISTS);
            if (cachedPlaylists) {
                setPlaylists(cachedPlaylists);
                return cachedPlaylists;
            }

            const playlistsResponse = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/playlists?limit=10&fields=items(id,name,tracks.href,images)',
                    { headers: { Authorization: `Bearer ${token}` } }
                )
            );

            const playlistsWithSongs = [];
            for (const playlist of playlistsResponse.data.items.slice(0, 10)) {
                try {
                    const tracksResponse = await apiCallWithBackoff(() =>
                        axios.get(
                            `${playlist.tracks.href}?fields=items(track(id,name,artists(name),album(name,images),duration_ms,preview_url,uri))`,
                            { headers: { Authorization: `Bearer ${token}` } }
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
                            cover: item.track.album.images[0]?.url || 'https://via.placeholder.com/300',
                            genre: 'Unknown',
                            plays: 0,
                            preview_url: item.track.preview_url || null,
                            spotify_uri: item.track.uri
                        }));
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: playlistSongs,
                        cover: playlist.images?.[0]?.url || playlistSongs[0]?.cover || 'https://via.placeholder.com/300'
                    });
                } catch (err) {
                    console.error(`Error fetching tracks for playlist ${playlist.name}:`, err);
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: [],
                        cover: playlist.images?.[0]?.url || 'https://via.placeholder.com/300'
                    });
                }
            }
            setPlaylists(playlistsWithSongs);
            setCachedData(CACHE_KEY_PLAYLISTS, playlistsWithSongs);
            return playlistsWithSongs;
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait.' : 'Failed to fetch playlists');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const searchSongs = useCallback(async (query) => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

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
                        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&fields=tracks(items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity))`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    )
                );
                const mappedSongs = response.data.tracks.items.map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                    cover: track.album.images[0]?.url || 'https://via.placeholder.com/300',
                    genre: 'Unknown',
                    plays: track.popularity * 10000,
                    preview_url: track.preview_url || null,
                    spotify_uri: track.uri
                }));
                setFilteredSongs(mappedSongs);
            } catch (err) {
                console.error('Search failed:', err);
                setError(err.response?.status === 429 ? 'Too many searches. Please wait.' : 'Search failed');
            } finally {
                setLoading(false);
            }
        }, 800);
    }, [accessToken]);

    const createPlaylist = async () => {
        if (!newPlaylistName.trim()) {
            setError('Playlist name cannot be empty');
            return;
        }

        if (accessToken && currentUser?.id) {
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
                    cover: data.images[0]?.url || 'https://via.placeholder.com/300'
                }]);
                setNewPlaylistName('');
                setShowCreatePlaylist(false);
                setError(null);
            } catch (err) {
                console.error('Failed to create playlist:', err);
                setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait.' : 'Failed to create playlist');
            }
        }
    };

    const isSongPlayable = useCallback((song) => {
        if (!song) return false;
        if (song.preview_url) return true;
        if (song.spotify_uri && isPremium && playerReady) return true;
        return false;
    }, [isPremium, playerReady]);

    const selectSong = useCallback(async (song, songList = null) => {
        if (isLoadingRef.current) {
            console.log("Already loading a song, ignoring duplicate call");
            return;
        }

        if (!isSongPlayable(song)) {
            setError(`No playable content available for ${song.title}`);
            setCurrentSong(song);
            setIsPlaying(false);
            return;
        }

        isLoadingRef.current = true;

        setQueue((prevQueue) => {
            if (songList && songList.length > 0) {
                const validSongs = songList.filter((s) => isSongPlayable(s));
                if (validSongs.length === 0) {
                    setError("No playable songs in the provided list");
                    isLoadingRef.current = false;
                    return prevQueue;
                }
                const index = validSongs.findIndex((s) => s.id === song.id);
                setCurrentIndex(index >= 0 ? index : 0);
                return validSongs;
            } else if (!prevQueue.some((s) => s.id === song.id)) {
                const validSongs = (filteredSongs.length > 0 ? filteredSongs : songs).filter((s) =>
                    isSongPlayable(s)
                );
                const index = validSongs.findIndex((s) => s.id === song.id);
                setCurrentIndex(index >= 0 ? index : 0);
                return validSongs;
            }

            const index = prevQueue.findIndex((s) => s.id === song.id);
            if (index >= 0) setCurrentIndex(index);
            return prevQueue;
        });

        setCurrentSong(song);
        setIsPlaying(true);
        setError(null);
        setRecentlyPlayed((prev) => {
            const newPlayed = [song, ...prev.filter((s) => s.id !== song.id)];
            return newPlayed.slice(0, 5);
        });

        setTimeout(() => {
            isLoadingRef.current = false;
        }, 500);
    }, [filteredSongs, songs, isSongPlayable]);

    const playNext = useCallback(() => {
        setQueue(currentQueue => {
            if (currentQueue.length === 0) return currentQueue;

            setCurrentIndex(prevIndex => {
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

                selectSong(currentQueue[nextIndex]);
                return nextIndex;
            });

            return currentQueue;
        });
    }, [shuffle, repeat, selectSong]);

    const playPrevious = useCallback(() => {
        if (queue.length === 0) return;

        if (currentTime > 3) {
            if (isPremium && spotifyPlayer && deviceId) {
                spotifyPlayer.seek(0);
            } else if (audioRef.current) {
                audioRef.current.currentTime = 0;
            }
            return;
        }

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
    }, [queue, currentIndex, currentTime, repeat, isPremium, spotifyPlayer, deviceId, selectSong]);

    const fetchUserProfile = useCallback(async (token) => {
        if (profileLoadedRef.current) {
            console.log('Profile already loaded, skipping...');
            return;
        }

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
                avatar: data.images?.[0]?.url || 'https://via.placeholder.com/100',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsPremium(user.product === 'premium');
            window.localStorage.setItem('user', JSON.stringify(user));

            profileLoadedRef.current = true;

            const topTracks = await fetchTopTracks(token);
            const uniqueArtists = [...new Set(topTracks.map(song => song.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: topTracks.filter(s => s.artist === name).length,
                albums: new Set(topTracks.filter(s => s.artist === name).map(s => s.album)).size
            })));
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(err.response?.status === 429 ? 'Too many requests. Please wait.' : 'Failed to fetch profile');
        } finally {
            setLoading(false);
        }
    }, [fetchTopTracks]);

    const loadSpotifyData = useCallback(async () => {
        if (!accessToken) return;

        try {
            setLoading(true);
            setError(null);

            await fetchTopTracks(accessToken);
            await fetchUserPlaylists(accessToken);
        } catch (err) {
            console.error('Failed to load Spotify data:', err);
            setError(err.response?.status === 429 ? 'Too many requests. Please try again.' : 'Failed to load Spotify data');
        } finally {
            setLoading(false);
        }
    }, [accessToken, fetchTopTracks, fetchUserPlaylists]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        const handleTokenExchange = async () => {
            const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
            if (!codeVerifier) {
                setError('Missing code verifier');
                return;
            }

            try {
                const response = await axios.post(
                    'https://accounts.spotify.com/api/token',
                    new URLSearchParams({
                        client_id: CLIENT_ID,
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: REDIRECT_URI,
                        code_verifier: codeVerifier
                    }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

                const { access_token } = response.data;
                window.localStorage.setItem('spotify_token', access_token);
                window.localStorage.removeItem('spotify_code_verifier');
                setAccessToken(access_token);

                window.history.replaceState({}, document.title, window.location.pathname);

                await fetchUserProfile(access_token);
            } catch (err) {
                console.error('Token exchange error:', err);
                setError('Failed to authenticate with Spotify');
            }
        };

        if (code && !accessToken) {
            handleTokenExchange();
        }
    }, [accessToken, fetchUserProfile]);

    useEffect(() => {
        const storedUser = window.localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            setIsPremium(user.product === 'premium');
            profileLoadedRef.current = true;
        }

        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken && !profileLoadedRef.current) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile]);

    useEffect(() => {
        if (!accessToken || !isPremium) return;

        let scriptElement = null;
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
                    setPlayerReady(true);
                    apiCallWithBackoff(() =>
                        axios.put(
                            'https://api.spotify.com/v1/me/player',
                            { device_ids: [device_id], play: false },
                            { headers: { Authorization: `Bearer ${accessToken}` } }
                        )
                    ).catch(err => console.error('Failed to transfer playback:', err));
                });
                playerInstance.addListener('not_ready', ({ device_id }) => {
                    console.log('Device ID has gone offline', device_id);
                    setDeviceId(null);
                    setPlayerReady(false);
                });
                playerInstance.addListener('initialization_error', ({ message }) => {
                    console.error('Spotify Player initialization error:', message);
                    setError('Failed to initialize Spotify player');
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
                            duration: new Date(track.duration).toISOString().substr(14, 5),
                            cover: track.album.images[0]?.url || 'https://via.placeholder.com/300',
                            genre: 'Unknown',
                            plays: 0,
                            spotify_uri: track.uri
                        };
                        setCurrentSong(newSong);
                        setRecentlyPlayed(prev => {
                            const newPlayed = [newSong, ...prev.filter(s => s.id !== track.id)];
                            return newPlayed.slice(0, 5);
                        });
                    }
                });

                playerInstance.connect().catch(err => {
                    console.error('Spotify Player connection error:', err);
                    setError('Failed to connect Spotify player');
                });
            } else {
                setError('Spotify Web Playback SDK not loaded');
            }
        };

        if (!window.Spotify) {
            scriptElement = document.createElement('script');
            scriptElement.src = 'https://sdk.scdn.co/spotify-player.js';
            scriptElement.async = true;
            scriptElement.onerror = () => {
                console.error('Failed to load Spotify SDK script');
                setError('Failed to load Spotify player');
            };
            document.body.appendChild(scriptElement);
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
        } else {
            initializePlayer();
        }

        return () => {
            if (playerInstance) {
                playerInstance.disconnect();
            }
            if (scriptElement && document.body.contains(scriptElement)) {
                document.body.removeChild(scriptElement);
            }
        };
    }, [accessToken, isPremium, volume]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
        }
        if (spotifyPlayer && playerReady) {
            spotifyPlayer.setVolume(volume / 100).catch(err =>
                console.error('Failed to set volume:', err)
            );
        }
    }, [volume, spotifyPlayer, playerReady]);

    useEffect(() => {
        if (!currentSong) return;

        let isCancelled = false;
        let retryTimeout = null;

        const playSong = async () => {
            if (isLoadingRef.current) {
                console.log("Already loading song, skipping duplicate playback attempt");
                return;
            }
            isLoadingRef.current = true;

            try {
                setIsLoadingSong(true);
                setError(null);

                if (isPremium && playerReady && deviceId && currentSong.spotify_uri) {
                    await apiCallWithBackoff(() =>
                        axios.put(
                            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                            { uris: [currentSong.spotify_uri] },
                            { headers: { Authorization: `Bearer ${accessToken}` } }
                        )
                    );
                    console.log("Playing via Spotify SDK");
                    return;
                }

                if (audioRef.current && currentSong.preview_url) {
                    const audio = audioRef.current;
                    audio.src = currentSong.preview_url;
                    audio.load();

                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Load timeout")), 10000);
                        audio.onloadedmetadata = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        audio.onerror = (e) => {
                            clearTimeout(timeout);
                            reject(new Error("Audio load failed"));
                        };
                    });

                    if (!isCancelled && isPlaying) {
                        await audio.play();
                        console.log("Preview playing");
                    }
                    return;
                }

                if (!isCancelled) {
                    setError(currentSong.spotify_uri && !isPremium
                        ? `${currentSong.title} requires Spotify Premium`
                        : `No playable content for ${currentSong.title}`);
                    setIsPlaying(false);
                }
            } catch (err) {
                if (!isCancelled) {
                    if (err.response?.status === 429) {
                        const retryAfter = parseInt(err.response.headers["retry-after"] || "10", 10) * 1000;
                        console.warn(`Rate limited. Retrying after ${retryAfter}ms...`);
                        retryTimeout = setTimeout(playSong, retryAfter + Math.random() * 100);
                    } else {
                        setError(`Failed to play: ${err.message}`);
                        setIsPlaying(false);
                    }
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingSong(false);
                    isLoadingRef.current = false;
                }
            }
        };

        playSong();

        return () => {
            isCancelled = true;
            isLoadingRef.current = false;
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [currentSong, isPremium, playerReady, deviceId, accessToken, isPlaying]);

    useEffect(() => {
        if (!audioRef.current || isPremium) return;

        const audio = audioRef.current;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
        const handleLoadedMetadata = () => setDuration(audio.duration || 30);
        const handleError = () => setError('Error loading audio file');

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);

        if (isPlaying && !isLoadingSong) {
            audio.play().catch(err => {
                if (err.name !== 'AbortError') {
                    setError('Playback error. Please try again.');
                    setIsPlaying(false);
                }
            });
        } else {
            audio.pause();
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
        };
    }, [isPlaying, isLoadingSong, isPremium]);

    useEffect(() => {
        if (!spotifyPlayer || !isPremium || !playerReady) return;

        const updateState = async () => {
            const state = await spotifyPlayer.getCurrentState();
            if (state) {
                setIsPlaying(!state.paused);
                setCurrentTime(state.position / 1000);
                setDuration(state.duration / 1000);
            }
        };

        const interval = setInterval(updateState, 1000);
        return () => clearInterval(interval);
    }, [spotifyPlayer, isPremium, playerReady]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || isPremium) return;

        const handleEnded = () => {
            if (repeat === 'one') {
                audio.currentTime = 0;
                audio.play().catch(err => console.error('Replay error:', err));
            } else {
                playNext();
            }
        };

        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [repeat, isPremium, playNext]);

    const handleSpotifyLogin = async () => {
        const codeVerifier = generateCodeVerifier();
        window.localStorage.setItem('spotify_code_verifier', codeVerifier);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=${RESPONSE_TYPE}&code_challenge=${codeChallenge}&code_challenge_method=${CODE_CHALLENGE_METHOD}`;
        window.location.href = authUrl;
    };

    const handleLogout = () => {
        setAccessToken(null);
        setCurrentUser(null);
        setCurrentSong(null);
        setIsPlaying(false);
        setActiveTab('home');
        setSongs([]);
        setFilteredSongs([]);
        setPlaylists([]);
        setQueue([]);
        setCurrentIndex(0);
        setRecentlyPlayed([]);
        setSpotifyPlayer(null);
        setDeviceId(null);
        setPlayerReady(false);
        profileLoadedRef.current = false;

        window.localStorage.removeItem('spotify_token');
        window.localStorage.removeItem('spotify_code_verifier');
        window.localStorage.removeItem('user');
        router.push('/login');
    };

    const togglePlay = () => {
        if (!currentSong) return;
        if (isPremium && spotifyPlayer && playerReady) {
            if (isPlaying) {
                spotifyPlayer.pause().catch(err => setError('Failed to pause'));
            } else {
                spotifyPlayer.resume().catch(err => setError('Failed to resume'));
            }
            setIsPlaying(!isPlaying);
        } else if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(err => setError('Playback error'));
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleShuffle = () => setShuffle(prev => !prev);

    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        setRepeat(prev => {
            const currentModeIndex = modes.indexOf(prev);
            return modes[(currentModeIndex + 1) % modes.length];
        });
    };

    const toggleLike = (songId) => {
        setLikedSongs(prev => {
            const newLiked = new Set(prev);
            if (newLiked.has(songId)) {
                newLiked.delete(songId);
            } else {
                newLiked.add(songId);
            }
            return newLiked;
        });
    };

    const handleSeek = async (e) => {
        if (!currentSong || !duration) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const seekTime = (clickX / width) * duration;

        if (isPremium && spotifyPlayer && deviceId) {
            try {
                await spotifyPlayer.seek(seekTime * 1000);
                setCurrentTime(seekTime);
            } catch (err) {
                setError('Failed to seek track');
            }
        } else if (audioRef.current) {
            audioRef.current.currentTime = seekTime;
            setCurrentTime(seekTime);
        }
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        searchSongs(query);
    };

    const applyFilters = useCallback(() => {
        let filtered = [...songs];

        if (filterGenre !== 'all') {
            filtered = filtered.filter(song => song.genre === filterGenre);
        }
        if (filterArtist !== 'all') {
            filtered = filtered.filter(song => song.artist === filterArtist);
        }
        if (searchQuery) {
            filtered = filtered.filter(song =>
                song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.album.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredSongs(filtered);
    }, [songs, filterGenre, filterArtist, searchQuery]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const addSongToPlaylist = (playlistId) => {
        if (!selectedSongForPlaylist) return;

        setPlaylists(prev => prev.map(playlist => {
            if (playlist.id === playlistId) {
                const songExists = playlist.songs.some(s => s.id === selectedSongForPlaylist.id);
                if (!songExists) {
                    return { ...playlist, songs: [...playlist.songs, selectedSongForPlaylist] };
                }
            }
            return playlist;
        }));

        setShowAddToPlaylist(false);
        setSelectedSongForPlaylist(null);
    };

    const openPlaylist = (playlist) => {
        setSelectedPlaylist(playlist);
        setActiveTab('playlist-detail');
    };

    const playAllSongs = (songList) => {
        if (songList.length === 0) {
            setError('No songs in this playlist');
            return;
        }

        const validSongs = songList.filter((s) => isSongPlayable(s));
        if (validSongs.length === 0) {
            setError('No playable songs in this playlist');
            return;
        }

        selectSong(validSongs[0], validSongs);
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
            <audio ref={audioRef} />
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
                            {loading && <span className="search-loading">Searching...</span>}
                        </div>
                    </div>
                    <div className="header-right">
                        <Image
                            src={currentUser.avatar || 'https://via.placeholder.com/100'}
                            alt={currentUser.name}
                            className="user-avatar"
                            width={100}
                            height={100}
                            priority
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
                    <div className="quick-playlists">
                        <h3 className="quick-title">Quick Playlists</h3>
                        <div className="playlist-list">
                            {playlists.slice(0, 3).map((playlist) => (
                                <div
                                    key={playlist.id}
                                    className="playlist-item"
                                    onClick={() => openPlaylist(playlist)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && openPlaylist(playlist)}
                                >
                                    <Image
                                        src={playlist.cover}
                                        alt={playlist.name}
                                        className="playlist-cover"
                                        width={300}
                                        height={300}
                                        loading="lazy"
                                    />
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
                                {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : (
                                    <>
                                        {accessToken && currentUser && (
                                            <div style={{
                                                padding: '20px',
                                                background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
                                                borderRadius: '12px',
                                                margin: '20px 0',
                                                textAlign: 'center',
                                                boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)'
                                            }}>
                                                <h3 style={{
                                                    color: 'white',
                                                    marginBottom: '10px',
                                                    fontSize: '20px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    🎵 Load Your Spotify Library
                                                </h3>
                                                <button
                                                    onClick={loadSpotifyData}
                                                    disabled={loading}
                                                    style={{
                                                        padding: '12px 32px',
                                                        background: 'white',
                                                        color: '#1DB954',
                                                        border: 'none',
                                                        borderRadius: '24px',
                                                        fontSize: '16px',
                                                        fontWeight: 'bold',
                                                        cursor: loading ? 'not-allowed' : 'pointer',
                                                        opacity: loading ? 0.6 : 1,
                                                        transition: 'all 0.3s ease',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        if (!loading) {
                                                            e.target.style.transform = 'scale(1.05)';
                                                            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                                        }
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.target.style.transform = 'scale(1)';
                                                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                                    }}
                                                >
                                                    {loading ? '⏳ Loading Spotify Data...' : '📥 Load My Music from Spotify'}
                                                </button>
                                                <p style={{
                                                    color: 'rgba(255,255,255,0.9)',
                                                    marginTop: '10px',
                                                    fontSize: '13px'
                                                }}>
                                                    Click to load your personalized top tracks and playlists from Spotify
                                                </p>
                                            </div>
                                        )}
                                        <div className="featured-songs">
                                            {songs.map((song) => (
                                                <div
                                                    key={song.id}
                                                    className="song-card"
                                                    onClick={() => selectSong(song)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}
                                                >
                                                    <div className="song-cover-container">
                                                        <Image
                                                            src={song.cover}
                                                            alt={song.title}
                                                            className="song-cover"
                                                            width={300}
                                                            height={300}
                                                            loading="lazy"
                                                        />
                                                        <button className="play-overlay"><Play className="play-icon" /></button>
                                                    </div>
                                                    <h3 className="song-title">{song.title}</h3>
                                                    <p className="song-artist">{song.artist}</p>
                                                    <Heart
                                                        className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="recent-section">
                                            <h3 className="section-title">Recently Played</h3>
                                            <div className="recent-list">
                                                {recentlyPlayed.slice(0, 3).map((song) => (
                                                    <div
                                                        key={song.id}
                                                        className="recent-item"
                                                        onClick={() => selectSong(song)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}
                                                    >
                                                        <Image
                                                            src={song.cover}
                                                            alt={song.title}
                                                            className="recent-cover"
                                                            width={300}
                                                            height={300}
                                                            loading="lazy"
                                                        />
                                                        <div className="recent-info">
                                                            <h4 className="recent-title">{song.title}</h4>
                                                            <p className="recent-artist">{song.artist} • {song.album}</p>
                                                        </div>
                                                        <span className="recent-duration">{song.duration}</span>
                                                        <button className="recent-play"><Play className="recent-play-icon" /></button>
                                                        <Heart
                                                            className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="recommendations-section">
                                            <h3 className="section-title">Recommended For You</h3>
                                            <div className="featured-songs">
                                                {recommendations.map((song) => (
                                                    <div
                                                        key={song.id}
                                                        className="song-card"
                                                        onClick={() => selectSong(song)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}
                                                    >
                                                        <div className="song-cover-container">
                                                            <Image
                                                                src={song.cover}
                                                                alt={song.title}
                                                                className="song-cover"
                                                                width={300}
                                                                height={300}
                                                                loading="lazy"
                                                            />
                                                            <button className="play-overlay"><Play className="play-icon" /></button>
                                                        </div>
                                                        <h3 className="song-title">{song.title}</h3>
                                                        <p className="song-artist">{song.artist}</p>
                                                        <span className="song-genre">{song.genre}</span>
                                                        <Heart
                                                            className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                                                        />
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
                            <h2 className="page-title">Search & Browse</h2>
                            <div className="filter-section">
                                <div className="filter-group">
                                    <label className="filter-label">Genre:</label>
                                    <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} className="filter-select">
                                        <option value="all">All Genres</option>
                                        <option value="Pop">Pop</option><option value="Electronic">Electronic</option><option value="Acoustic">Acoustic</option>
                                        <option value="Hip-Hop">Hip-Hop</option><option value="Rock">Rock</option><option value="Jazz">Jazz</option>
                                        <option value="Classical">Classical</option><option value="Country">Country</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Artist:</label>
                                    <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className="filter-select">
                                        <option value="all">All Artists</option>
                                        {artists.map((artist) => <option key={artist.id} value={artist.name}>{artist.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : filteredSongs.length > 0 ? (
                                <div className="search-results">
                                    {filteredSongs.map((song) => (
                                        <div
                                            key={song.id}
                                            className="search-item"
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}
                                        >
                                            <Image
                                                src={song.cover}
                                                alt={song.title}
                                                className="search-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                                onClick={() => selectSong(song)}
                                            />
                                            <div className="search-info" onClick={() => selectSong(song)}>
                                                <h4 className="search-title">{song.title}</h4>
                                                <p className="search-artist">{song.artist} • {song.album}</p>
                                                <p className="search-genre">{song.genre}</p>
                                            </div>
                                            <div className="search-actions">
                                                <span className="search-duration">{song.duration}</span>
                                                <button
                                                    className="add-playlist-btn"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedSongForPlaylist(song); setShowAddToPlaylist(true); }}
                                                    title="Add to playlist"
                                                >
                                                    <Plus className="plus-icon-small" />
                                                </button>
                                                <Heart
                                                    className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                                                />
                                                <button className="search-play" onClick={() => selectSong(song)}>
                                                    <Play className="search-play-icon" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-search">
                                    <Search className="empty-icon" />
                                    <p className="empty-text">{searchQuery ? 'No songs found' : 'Use filters to browse songs or search above'}</p>
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
                            {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : (
                                <div className="playlists-grid">
                                    {playlists.map((playlist) => (
                                        <div
                                            key={playlist.id}
                                            className="playlist-card"
                                            onClick={() => openPlaylist(playlist)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && openPlaylist(playlist)}
                                        >
                                            <Image
                                                src={playlist.cover}
                                                alt={playlist.name}
                                                className="playlist-card-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="playlist-card-overlay">
                                                <button
                                                    className="playlist-play-btn"
                                                    onClick={(e) => { e.stopPropagation(); playAllSongs(playlist.songs); }}
                                                >
                                                    <Play className="play-icon" />
                                                </button>
                                            </div>
                                            <h3 className="playlist-card-name">{playlist.name}</h3>
                                            <p className="playlist-card-count">{playlist.songs.length} songs</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'playlist-detail' && selectedPlaylist && (
                        <div className="playlist-detail-content">
                            <div className="playlist-detail-header">
                                <button onClick={() => setActiveTab('playlists')} className="back-btn">← Back to Playlists</button>
                                <div className="playlist-header-content">
                                    <Image
                                        src={selectedPlaylist.cover}
                                        alt={selectedPlaylist.name}
                                        className="playlist-detail-cover"
                                        width={300}
                                        height={300}
                                        loading="lazy"
                                    />
                                    <div className="playlist-header-info">
                                        <h2 className="playlist-detail-title">{selectedPlaylist.name}</h2>
                                        <p className="playlist-detail-count">{selectedPlaylist.songs.length} songs</p>
                                        {selectedPlaylist.songs.length > 0 && (
                                            <button onClick={() => playAllSongs(selectedPlaylist.songs)} className="play-all-btn">
                                                <Play className="play-icon" /> Play All
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="playlist-songs-list">
                                {selectedPlaylist.songs.length === 0 ? (
                                    <div className="empty-playlist">
                                        <Music className="empty-icon" />
                                        <p className="empty-text">No songs in this playlist yet</p>
                                        <button onClick={() => setActiveTab('search')} className="browse-btn">Browse Songs</button>
                                    </div>
                                ) : (
                                    selectedPlaylist.songs.map((song, index) => (
                                        <div
                                            key={song.id}
                                            className="playlist-song-item"
                                            onClick={() => selectSong(song, selectedPlaylist.songs)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && selectSong(song, selectedPlaylist.songs)}
                                        >
                                            <span className="song-number">{index + 1}</span>
                                            <Image
                                                src={song.cover}
                                                alt={song.title}
                                                className="playlist-song-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="playlist-song-info">
                                                <h4 className="playlist-song-title">{song.title}</h4>
                                                <p className="playlist-song-artist">{song.artist}</p>
                                            </div>
                                            <span className="playlist-song-album">{song.album}</span>
                                            <span className="playlist-song-duration">{song.duration}</span>
                                            <button className="playlist-song-play">
                                                <Play className="play-icon-small" />
                                            </button>
                                            <Heart
                                                className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleLike(song.id);
                                                }}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
            {showAddToPlaylist && (
                <div className="modal-overlay" onClick={() => setShowAddToPlaylist(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Add to Playlist</h3>
                        <p className="modal-subtitle">Select a playlist for {selectedSongForPlaylist?.title}</p>
                        <div className="modal-playlist-list">
                            {playlists.map((playlist) => (
                                <button key={playlist.id} onClick={() => addSongToPlaylist(playlist.id)} className="modal-playlist-item">
                                    <Image
                                        src={playlist.cover}
                                        alt={playlist.name}
                                        className="modal-playlist-cover"
                                        width={300}
                                        height={300}
                                        loading="lazy"
                                    />
                                    <span className="modal-playlist-name">{playlist.name}</span>
                                    <span className="modal-playlist-count">{playlist.songs.length} songs</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAddToPlaylist(false)} className="modal-close-btn">Close</button>
                    </div>
                </div>
            )}
            {currentSong && (
                <div className="music-player">
                    <div className="player-content">
                        <div className="player-left">
                            <Image
                                src={currentSong.cover}
                                alt={currentSong.title}
                                className="player-cover"
                                width={300}
                                height={300}
                                loading="lazy"
                            />
                            <div className="player-info">
                                <h4 className="player-title">{currentSong.title}</h4>
                                <p className="player-artist">{currentSong.artist}</p>
                                {(!isPremium || !currentSong.spotify_uri) && currentSong.preview_url && <p className="player-note">30-second preview</p>}
                            </div>
                        </div>
                        <div className="player-controls">
                            <button className={`control-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}>
                                <Shuffle className="control-icon" />
                            </button>
                            <button className="control-btn" onClick={playPrevious}>
                                <SkipBack className="control-icon" />
                            </button>
                            <button onClick={togglePlay} className="play-btn" disabled={!isSongPlayable(currentSong)}>
                                {isPlaying ? <Pause className="play-icon" /> : <Play className="play-icon" />}
                            </button>
                            <button className="control-btn" onClick={playNext}>
                                <SkipForward className="control-icon" />
                            </button>
                            <button className={`control-btn ${repeat !== 'off' ? 'active' : ''}`} onClick={toggleRepeat}>
                                <Repeat className="control-icon" />
                                {repeat === 'one' && <span className="repeat-indicator">1</span>}
                            </button>
                        </div>
                        <div className="player-right">
                            <Heart
                                className={`heart-btn ${likedSongs.has(currentSong.id) ? 'liked' : ''}`}
                                onClick={() => toggleLike(currentSong.id)}
                            />
                            <div className="volume-controls">
                                <Volume2 className="volume-icon" />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={volume}
                                    onChange={(e) => setVolume(Number(e.target.value))}
                                    className="volume-slider"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="progress-section">
                        {error && <p className="player-error">{error}</p>}
                        <div className="progress-time">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <div className="progress-bar" onClick={handleSeek}>
                            <div className="progress-fill" style={{ width: `${(currentTime / duration) * 100 || 0}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

}