'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, Plus, Shuffle, Repeat
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Full-featured music page with:
 * - Spotify OAuth code exchange (PKCE)
 * - Fetch top tracks & playlists
 * - Spotify Web Playback SDK (Premium playback)
 * - Preview-based audio fallback
 * - Removed default/static songs
 * - Recommendations based only on recentlyPlayed
 * - Fixed play/pause, volume, progress, seeking, duration updates
 *
 * Make sure environment variables exist:
 * NEXT_PUBLIC_SPOTIFY_CLIENT_ID
 * NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
 */

const debounce = (fn, wait) => {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
};

export default function Page() {
    const router = useRouter();

    // --- Basic UI / Player state ---
    const [currentUser, setCurrentUser] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(70);
    const [activeTab, setActiveTab] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [playlists, setPlaylists] = useState([]);
    const [songs, setSongs] = useState([]); // initially empty (no static defaults)
    const [filteredSongs, setFilteredSongs] = useState([]);
    const [artists, setArtists] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [likedSongs, setLikedSongs] = useState(new Set());
    const [recentlyPlayed, setRecentlyPlayed] = useState([]);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('off'); // off | all | one
    const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
    const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);

    // spotify-related state
    const [accessToken, setAccessToken] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [spotifyPlayer, setSpotifyPlayer] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [deviceId, setDeviceId] = useState(null);

    // misc
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const audioRef = useRef(null);
    const isLoadingRef = useRef(false);
    const profileLoadedRef = useRef(false);
    const searchTimerRef = useRef(null);

    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';

    // caching
    const CACHE_KEY_TOP_TRACKS = 'spotify_top_tracks';
    const CACHE_KEY_PLAYLISTS = 'spotify_playlists';
    const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

    // ----- Utilities -----

    const apiCallWithBackoff = async (requestFn, maxRetries = 3) => {
        // increment counter for debugging
        let apiCallCount = JSON.parse(window.localStorage.getItem('apiCallCount') || '0') + 1;
        window.localStorage.setItem('apiCallCount', apiCallCount);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (err) {
                if (err.response?.status === 429) {
                    const retryAfter = parseInt(err.response.headers['retry-after'] || '10', 10) * 1000;
                    await new Promise(res => setTimeout(res, retryAfter + Math.random() * 100));
                    continue;
                }
                if (attempt === maxRetries - 1) throw err;
                await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
            }
        }
        throw new Error('Max retries reached');
    };

    const getCachedData = (key) => {
        const cached = window.localStorage.getItem(key);
        if (!cached) return null;
        try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY_MS) return data;
            return null;
        } catch {
            return null;
        }
    };

    const setCachedData = (key, data) => {
        try {
            window.localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
        } catch { /* ignore */ }
    };

    const generateCodeVerifier = () => {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const generateCodeChallenge = async (verifier) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    // ----- Recommendations (based only on recentlyPlayed) -----
    const generateRecommendations = useCallback(() => {
        if (!recentlyPlayed || recentlyPlayed.length === 0) {
            setRecommendations([]);
            return;
        }
        // simple approach: weight recent items and return up to 6
        const recommended = [...recentlyPlayed]
            .slice(0, 10) // most recent 10
            .sort(() => 0.5 - Math.random())
            .slice(0, 6);
        setRecommendations(recommended);
    }, [recentlyPlayed]);

    // ----- Spotify / Data fetching -----

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            const cached = getCachedData(CACHE_KEY_TOP_TRACKS);
            if (cached) {
                setSongs(prev => {
                    // merge new songs while avoiding duplicates
                    const merged = [...cached];
                    return merged;
                });
                return cached;
            }

            // fetch top tracks
            const response = await apiCallWithBackoff(() => axios.get(
                'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=20',
                { headers: { Authorization: `Bearer ${token}` } }
            ));
            const items = response.data.items || [];
            const mapped = items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images?.[0]?.url || '',
                genre: 'Unknown',
                plays: (track.popularity || 0) * 100,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri
            }));

            setSongs(prev => {
                const combined = [...mapped];
                return combined;
            });
            setCachedData(CACHE_KEY_TOP_TRACKS, mapped);
            return mapped;
        } catch (err) {
            console.error('fetchTopTracks err', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded' : 'Failed to fetch top tracks');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserPlaylists = useCallback(async (token) => {
        try {
            setLoading(true);
            const cached = getCachedData(CACHE_KEY_PLAYLISTS);
            if (cached) {
                setPlaylists(cached);
                return cached;
            }

            const playlistsResponse = await apiCallWithBackoff(() => axios.get(
                'https://api.spotify.com/v1/me/playlists?limit=20',
                { headers: { Authorization: `Bearer ${token}` } }
            ));

            const playlistsData = playlistsResponse.data.items || [];
            const playlistsWithSongs = [];

            for (const pl of playlistsData.slice(0, 10)) {
                try {
                    // rate-limiting gentle pause
                    await new Promise(res => setTimeout(res, 250));
                    const href = pl.tracks.href;
                    const tracksResponse = await apiCallWithBackoff(() => axios.get(
                        `${href}?fields=items(track(id,name,artists(name),album(name,images),duration_ms,preview_url,uri))&limit=50`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    ));
                    const tracks = (tracksResponse.data.items || []).filter(i => i.track && i.track.id).map(item => {
                        const track = item.track;
                        return {
                            id: track.id,
                            title: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            album: track.album.name,
                            duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                            cover: track.album.images?.[0]?.url || '',
                            genre: 'Unknown',
                            plays: 0,
                            preview_url: track.preview_url || null,
                            spotify_uri: track.uri
                        };
                    });
                    playlistsWithSongs.push({
                        id: pl.id,
                        name: pl.name,
                        songs: tracks,
                        cover: pl.images?.[0]?.url || tracks[0]?.cover || '',
                    });
                } catch (err) {
                    console.warn('playlist fetch error for', pl.name, err);
                    playlistsWithSongs.push({
                        id: pl.id,
                        name: pl.name,
                        songs: [],
                        cover: pl.images?.[0]?.url || ''
                    });
                }
            }

            setPlaylists(playlistsWithSongs);
            setCachedData(CACHE_KEY_PLAYLISTS, playlistsWithSongs);
            return playlistsWithSongs;
        } catch (err) {
            console.error('fetchUserPlaylists err', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded' : 'Failed to fetch playlists');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSpotifyData = useCallback(async () => {
        if (!accessToken) {
            setError('No access token');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const topTracks = await fetchTopTracks(accessToken);
            const userPlaylists = await fetchUserPlaylists(accessToken);

            // merge known songs from top tracks + playlists
            const allKnown = [...(topTracks || []), ...(userPlaylists.flatMap(p => p.songs) || [])];
            // dedupe by id
            const unique = allKnown.reduce((acc, s) => {
                if (!acc.some(x => x.id === s.id)) acc.push(s);
                return acc;
            }, []);
            setSongs(unique);
            setFilteredSongs(unique);

            // artists list
            const uniqueArtists = [...new Set(unique.map(s => s.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: unique.filter(s => s.artist === name).length,
                albums: new Set(unique.filter(s => s.artist === name).map(s => s.album)).size
            })));

            setError('Spotify library loaded');
            setTimeout(() => setError(null), 2500);
        } catch (err) {
            console.error('loadSpotifyData err', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded' : 'Failed to load Spotify data');
        } finally {
            setLoading(false);
        }
    }, [accessToken, fetchTopTracks, fetchUserPlaylists]);

    // ----- Spotify auth & PKCE exchange -----

    const handleSpotifyLogin = async () => {
        try {
            const codeVerifier = generateCodeVerifier();
            window.localStorage.setItem('spotify_code_verifier', codeVerifier);
            const codeChallenge = await generateCodeChallenge(codeVerifier);

            const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=${RESPONSE_TYPE}&code_challenge=${codeChallenge}&code_challenge_method=${CODE_CHALLENGE_METHOD}`;
            window.location.href = authUrl;
        } catch (err) {
            console.error('spotify login err', err);
            setError('Failed to start Spotify login');
        }
    };

    useEffect(() => {
        // handle code exchange
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        const handleTokenExchange = async () => {
            const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
            if (!codeVerifier) {
                setError('Missing code verifier');
                return;
            }
            try {
                const body = new URLSearchParams({
                    client_id: CLIENT_ID,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: codeVerifier
                });

                const response = await axios.post('https://accounts.spotify.com/api/token', body.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const token = response.data.access_token;
                window.localStorage.setItem('spotify_token', token);
                window.localStorage.removeItem('spotify_code_verifier');
                setAccessToken(token);

                // remove code param
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (err) {
                console.error('token exchange err', err);
                setError('Failed to authenticate with Spotify');
            }
        };

        if (code && !accessToken) handleTokenExchange();
    }, [accessToken]);

    // ----- Fetch user profile -----
    const fetchUserProfile = useCallback(async (token) => {
        if (!token) return;
        if (profileLoadedRef.current) return;

        try {
            setLoading(true);
            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = {
                id: data.id,
                name: data.display_name || data.id,
                email: data.email,
                avatar: data.images?.[0]?.url || '',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsPremium(user.product === 'premium');
            window.localStorage.setItem('user', JSON.stringify(user));

            profileLoadedRef.current = true;
            // Do not initialize songs with static data (we removed static songs)
        } catch (err) {
            console.error('fetchUserProfile err', err);
            setError('Failed to fetch profile');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // restore user/token on mount
        const storedUser = window.localStorage.getItem('user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setCurrentUser(u);
            setIsPremium(u.product === 'premium');
            profileLoadedRef.current = true;
        }
        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
            // intentionally do not auto-load library until user clicks "Load My Music" UI, to reduce rate use
        }
    }, [fetchUserProfile]);

    // ----- Spotify Web Playback SDK initialization for premium users -----
    useEffect(() => {
        if (!accessToken || !isPremium) return;
        let scriptEl = null;
        let playerInstance = null;

        const initializePlayer = () => {
            if (!window.Spotify) {
                setError('Spotify SDK not available');
                return;
            }

            playerInstance = new window.Spotify.Player({
                name: 'MusicStream Web Player',
                getOAuthToken: cb => cb(accessToken),
                volume: volume / 100
            });

            playerInstance.addListener('ready', ({ device_id }) => {
                setDeviceId(device_id);
                setPlayerReady(true);

                // transfer playback (do not auto-play)
                apiCallWithBackoff(() => axios.put('https://api.spotify.com/v1/me/player', { device_ids: [device_id], play: false }, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                })).catch(e => console.warn('transfer playback failed', e));
            });

            playerInstance.addListener('not_ready', ({ device_id }) => {
                setDeviceId(null);
                setPlayerReady(false);
            });

            playerInstance.addListener('initialization_error', ({ message }) => {
                console.error('Spotify SDK init err', message);
                setError('Spotify player initialization error');
            });

            playerInstance.addListener('authentication_error', ({ message }) => {
                console.error('Spotify auth err', message);
                setError('Spotify authentication error');
            });

            playerInstance.addListener('player_state_changed', (state) => {
                if (!state) return;
                setIsPlaying(!state.paused);
                setCurrentTime(state.position / 1000);
                setDuration(state.duration / 1000);
                // update current song from state
                const track = state.track_window?.current_track;
                if (track) {
                    const newSong = {
                        id: track.id,
                        title: track.name,
                        artist: track.artists.map(a => a.name).join(', '),
                        album: track.album.name,
                        duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                        cover: track.album.images?.[0]?.url || '',
                        spotify_uri: track.uri
                    };
                    setCurrentSong(newSong);
                    setRecentlyPlayed(prev => {
                        const newPlayed = [newSong, ...prev.filter(s => s.id !== newSong.id)];
                        return newPlayed.slice(0, 10);
                    });
                }
            });

            playerInstance.connect().then(success => {
                if (success) setSpotifyPlayer(playerInstance);
            }).catch(err => {
                console.error('player connect err', err);
                setError('Failed to connect Spotify player');
            });
        };

        if (!window.Spotify) {
            scriptEl = document.createElement('script');
            scriptEl.src = 'https://sdk.scdn.co/spotify-player.js';
            scriptEl.async = true;
            scriptEl.onload = () => {
                window.onSpotifyWebPlaybackSDKReady = initializePlayer;
            };
            scriptEl.onerror = () => {
                setError('Failed to load Spotify SDK');
            };
            document.body.appendChild(scriptEl);
        } else {
            initializePlayer();
        }

        return () => {
            if (playerInstance) playerInstance.disconnect();
            if (scriptEl && document.body.contains(scriptEl)) document.body.removeChild(scriptEl);
            setSpotifyPlayer(null);
            setPlayerReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, isPremium]);

    // keep player volume in sync
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume / 100;
        if (spotifyPlayer && playerReady) {
            spotifyPlayer.setVolume(volume / 100).catch(err => console.warn('setVolume err', err));
        }
    }, [volume, spotifyPlayer, playerReady]);

    // ----- Playback handling: preview (audio element) + spotify playback (premium) -----

    // check if song is playable (preview or spotify + premium + player ready)
    const isSongPlayable = useCallback((song) => {
        if (!song) return false;
        if (song.preview_url) return true;
        if (song.spotify_uri && isPremium && playerReady) return true;
        return false;
    }, [isPremium, playerReady]);

    // selectSong should also queue songs when provided with a list
    const selectSong = useCallback(async (song, songList = null) => {
        if (!song) return;

        if (!isSongPlayable(song)) {
            setError(`No playable content available for ${song.title}`);
            setCurrentSong(song);
            setIsPlaying(false);
            return;
        }

        if (isLoadingRef.current) {
            console.log('Already loading a song');
            return;
        }
        isLoadingRef.current = true;
        setError(null);

        // Setup queue
        setQueue(prevQueue => {
            // if a playlist/list provided, build validSongs from it
            if (songList && songList.length > 0) {
                const validSongs = songList.filter(s => isSongPlayable(s));
                if (validSongs.length === 0) {
                    setError('No playable songs in the provided list');
                    isLoadingRef.current = false;
                    return prevQueue;
                }
                const idx = validSongs.findIndex(s => s.id === song.id);
                setCurrentIndex(idx >= 0 ? idx : 0);
                return validSongs;
            }

            // if not in queue, put filteredSongs or songs
            const source = filteredSongs.length > 0 ? filteredSongs : songs;
            const valid = source.filter(s => isSongPlayable(s));
            if (!prevQueue.some(s => s.id === song.id)) {
                const idx = valid.findIndex(s => s.id === song.id);
                setCurrentIndex(idx >= 0 ? idx : 0);
                return valid;
            } else {
                const idx = prevQueue.findIndex(s => s.id === song.id);
                if (idx >= 0) setCurrentIndex(idx);
                return prevQueue;
            }
        });

        setCurrentSong(song);
        setIsPlaying(true);

        setRecentlyPlayed(prev => {
            const updated = [song, ...prev.filter(s => s.id !== song.id)];
            return updated.slice(0, 20);
        });

        // small delay to avoid race
        setTimeout(() => {
            isLoadingRef.current = false;
        }, 300);
    }, [filteredSongs, songs, isSongPlayable]);

    // playback effect: when currentSong or isPlaying changes, play via SDK or preview
    useEffect(() => {
        if (!currentSong) return;
        let retryTimeout = null;
        let cancelled = false;

        const playSong = async () => {
            if (isLoadingRef.current) return;
            isLoadingRef.current = true;
            setError(null);
            setIsLoadingRef.current?.();

            try {
                // Preferred path: Spotify SDK for premium users & available device
                if (currentSong.spotify_uri && isPremium && playerReady && spotifyPlayer && deviceId) {
                    try {
                        await apiCallWithBackoff(() => axios.put(
                            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                            { uris: [currentSong.spotify_uri] },
                            { headers: { Authorization: `Bearer ${accessToken}` } }
                        ));
                        // SDK handles state updates through player_state_changed
                        if (!cancelled) {
                            setRecentlyPlayed(prev => {
                                const updated = [currentSong, ...prev.filter(s => s.id !== currentSong.id)];
                                return updated.slice(0, 20);
                            });
                        }
                        return;
                    } catch (sdkErr) {
                        // retry on rate limit
                        if (sdkErr.response?.status === 429) {
                            const retryAfter = parseInt(sdkErr.response.headers['retry-after'] || '10', 10) * 1000;
                            retryTimeout = setTimeout(playSong, retryAfter + Math.random() * 200);
                            return;
                        }
                        // fall through to preview attempt
                        console.warn('SDK play failed; falling back to preview', sdkErr);
                    }
                }

                // Preview playback using <audio />
                if (audioRef.current && currentSong.preview_url) {
                    const audio = audioRef.current;
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = currentSong.preview_url;
                    audio.volume = volume / 100;

                    await new Promise((resolve, reject) => {
                        const loadTimeout = setTimeout(() => reject(new Error('Load timeout')), 10000);

                        const onLoaded = () => {
                            clearTimeout(loadTimeout);
                            resolve();
                        };
                        const onError = () => {
                            clearTimeout(loadTimeout);
                            reject(new Error('Audio load failed'));
                        };

                        audio.onloadedmetadata = onLoaded;
                        audio.onerror = onError;
                        audio.load();
                    });

                    if (!cancelled && isPlaying) {
                        await audio.play();
                        setError(null);
                        setRecentlyPlayed(prev => {
                            const updated = [currentSong, ...prev.filter(s => s.id !== currentSong.id)];
                            return updated.slice(0, 20);
                        });
                    }
                    return;
                }

                // If not playable
                if (!cancelled) {
                    if (currentSong.spotify_uri && !isPremium) {
                        setError(`${currentSong.title} requires Spotify Premium`);
                    } else {
                        setError(`No playable content for ${currentSong.title}`);
                    }
                    setIsPlaying(false);
                }
            } catch (err) {
                console.error('playSong err', err);
                if (!cancelled) {
                    if (err.response?.status === 429) {
                        const retryAfter = parseInt(err.response.headers['retry-after'] || '10', 10) * 1000;
                        retryTimeout = setTimeout(playSong, retryAfter + Math.random() * 200);
                    } else if (err.name === 'NotAllowedError') {
                        setError('Playback blocked. Click play to start.');
                        setIsPlaying(false);
                    } else {
                        setError(err.message || 'Playback failed');
                        setIsPlaying(false);
                    }
                }
            } finally {
                if (!cancelled) isLoadingRef.current = false;
            }
        };

        playSong();

        return () => {
            cancelled = true;
            isLoadingRef.current = false;
            if (retryTimeout) clearTimeout(retryTimeout);
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [currentSong?.id, accessToken, isPremium, playerReady, spotifyPlayer, deviceId, isPlaying, volume]);

    // audio element events (only for preview playback; SDK uses its own events)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
        const onLoadedMeta = () => setDuration(audio.duration || 30);
        const onError = (e) => {
            console.error('Audio error', e);
            setError('Audio playback error');
        };
        const onEnded = () => {
            if (repeat === 'one') {
                audio.currentTime = 0;
                audio.play().catch(err => console.warn('replay err', err));
            } else {
                // play next from queue
                playNext();
            }
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMeta);
        audio.addEventListener('error', onError);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMeta);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('ended', onEnded);
        };
    }, [repeat]);

    // keep SDK player state polling to sync position (optional)
    useEffect(() => {
        if (!spotifyPlayer || !isPremium || !playerReady) return;
        let interval = null;
        const updateState = async () => {
            try {
                const state = await spotifyPlayer.getCurrentState();
                if (state) {
                    setIsPlaying(!state.paused);
                    setCurrentTime(state.position / 1000);
                    setDuration(state.duration / 1000);
                }
            } catch (err) {
                console.warn('getCurrentState err', err);
            }
        };
        interval = setInterval(updateState, 1000);
        return () => clearInterval(interval);
    }, [spotifyPlayer, isPremium, playerReady]);

    // ----- Queue controls -----
    const playNext = useCallback(() => {
        setQueue(currentQueue => {
            if (!currentQueue || currentQueue.length === 0) return currentQueue;
            setCurrentIndex(prevIndex => {
                let nextIndex;
                if (shuffle) {
                    nextIndex = Math.floor(Math.random() * currentQueue.length);
                } else {
                    nextIndex = prevIndex + 1;
                    if (nextIndex >= currentQueue.length) {
                        if (repeat === 'all') nextIndex = 0;
                        else {
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
        if (!queue || queue.length === 0) return;
        if (currentTime > 3) {
            // restart current
            if (isPremium && spotifyPlayer && deviceId) {
                spotifyPlayer.seek(0).catch(err => console.warn('seek err', err));
            } else if (audioRef.current) {
                audioRef.current.currentTime = 0;
            }
            return;
        }
        let prevIdx = currentIndex - 1;
        if (prevIdx < 0) {
            if (repeat === 'all') prevIdx = queue.length - 1;
            else prevIdx = 0;
        }
        setCurrentIndex(prevIdx);
        selectSong(queue[prevIdx]);
    }, [queue, currentIndex, currentTime, repeat, isPremium, spotifyPlayer, deviceId, selectSong]);

    // ----- UI helpers -----
    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlayPause = () => {
        if (isPremium && spotifyPlayer && playerReady) {
            // control via SDK if possible
            spotifyPlayer.getCurrentState().then(state => {
                if (!state) {
                    // try to play currentSong via API if present
                    if (currentSong?.spotify_uri && deviceId) {
                        axios.put(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, { uris: [currentSong.spotify_uri] }, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        }).catch(err => console.warn('api play err', err));
                        setIsPlaying(true);
                    }
                } else {
                    if (state.paused) spotifyPlayer.resume().catch(err => console.warn('resume err', err));
                    else spotifyPlayer.pause().catch(err => console.warn('pause err', err));
                }
            }).catch(err => {
                console.warn('getCurrentState err', err);
                setIsPlaying(prev => !prev);
            });
        } else {
            setIsPlaying(prev => !prev);
        }
    };

    // Seeking (works for both SDK via API and audio element)
    const handleSeek = async (e) => {
        if (!duration || (!audioRef.current && !(spotifyPlayer && playerReady))) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const seekSeconds = (clickX / width) * duration;

        if (isPremium && spotifyPlayer && playerReady && deviceId) {
            const seekMs = Math.floor(seekSeconds * 1000);
            try {
                await axios.put(`https://api.spotify.com/v1/me/player/seek?device_id=${deviceId}&position_ms=${seekMs}`, {}, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setCurrentTime(seekSeconds);
            } catch (err) {
                console.warn('sdk seek fail', err);
                setError('Failed to seek track');
            }
        } else if (audioRef.current) {
            audioRef.current.currentTime = seekSeconds;
            setCurrentTime(seekSeconds);
        }
    };

    // ----- Search & Filters -----
    const searchSongs = useCallback(async (query) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!accessToken || !query) {
            // local filter fallback
            const filtered = songs.filter(song =>
                song.title.toLowerCase().includes(query.toLowerCase()) ||
                song.artist.toLowerCase().includes(query.toLowerCase()) ||
                song.album.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredSongs(filtered);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                const resp = await apiCallWithBackoff(() => axios.get(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                ));
                const items = resp.data.tracks?.items || [];
                const mapped = items.map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                    cover: track.album.images?.[0]?.url || '',
                    genre: 'Unknown',
                    plays: track.popularity * 100,
                    preview_url: track.preview_url || null,
                    spotify_uri: track.uri
                }));
                setFilteredSongs(mapped);
            } catch (err) {
                console.error('search err', err);
                setError(err.response?.status === 429 ? 'Too many searches' : 'Search failed');
            } finally {
                setLoading(false);
            }
        }, 700);
    }, [accessToken, songs]);

    // Apply filters to songs list when filters change
    const [filterGenre, setFilterGenre] = useState('all');
    const [filterArtist, setFilterArtist] = useState('all');

    const applyFilters = useCallback(() => {
        let filtered = [...songs];
        if (filterGenre !== 'all') filtered = filtered.filter(s => s.genre === filterGenre);
        if (filterArtist !== 'all') filtered = filtered.filter(s => s.artist === filterArtist);
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

    // ----- Playlist creation & add song to playlist (local UI only + Spotify API for remote playlists) -----
    const createPlaylist = async () => {
        if (!newPlaylistName.trim()) {
            setError('Playlist name cannot be empty');
            return;
        }
        if (!accessToken || !currentUser?.id) {
            setError('Please login with Spotify to create playlists');
            return;
        }
        try {
            setLoading(true);
            const { data } = await apiCallWithBackoff(() => axios.post(
                `https://api.spotify.com/v1/users/${currentUser.id}/playlists`,
                { name: newPlaylistName, public: true },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            ));
            setPlaylists(prev => [...prev, { id: data.id, name: data.name, songs: [], cover: data.images?.[0]?.url || '' }]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
            setError(null);
        } catch (err) {
            console.error('createPlaylist err', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded' : 'Failed to create playlist');
        } finally {
            setLoading(false);
        }
    };

    const addSongToPlaylist = (playlistId) => {
        if (!selectedSongForPlaylist) return;
        setPlaylists(prev => prev.map(pl => {
            if (pl.id === playlistId) {
                const exists = pl.songs.some(s => s.id === selectedSongForPlaylist.id);
                if (!exists) return { ...pl, songs: [...pl.songs, selectedSongForPlaylist] };
            }
            return pl;
        }));
        setShowAddToPlaylist(false);
        setSelectedSongForPlaylist(null);
    };

    // open playlist detail
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const openPlaylist = (playlist) => {
        setSelectedPlaylist(playlist);
        setActiveTab('playlist-detail');
    };

    const playAllSongs = (songList) => {
        if (!songList || songList.length === 0) {
            setError('No songs in this playlist');
            return;
        }
        const valid = songList.filter(s => isSongPlayable(s));
        if (valid.length === 0) {
            setError('No playable songs in playlist');
            return;
        }
        selectSong(valid[0], valid);
    };

    // toggles
    const toggleShuffle = () => setShuffle(prev => !prev);
    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        setRepeat(prev => modes[(modes.indexOf(prev) + 1) % modes.length]);
    };
    const toggleLike = (songId) => {
        setLikedSongs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(songId)) newSet.delete(songId);
            else newSet.add(songId);
            return newSet;
        });
    };

    // logout
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

    // helper for search input change
    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        searchSongs(q);
    };

    // update recommendations when recently played changes
    useEffect(() => {
        generateRecommendations();
    }, [recentlyPlayed, generateRecommendations]);

    // --- UI: if not logged in show login card ---
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
                        <button onClick={handleSpotifyLogin} className="login-btn spotify-btn">Login with Spotify</button>
                        <Link href="/login?type=user"><button className="login-btn user-btn">Login as User</button></Link>
                        <Link href="/login?type=admin"><button className="login-btn admin-btn">Login as Admin</button></Link>
                    </div>
                    {loading && <p>Loading...</p>}
                    {error && <p className="error-text">{error}</p>}
                </div>
            </div>
        );
    }

    // --- Main App UI ---
    return (
        <div className="app-container">
            <audio
                ref={audioRef}
                onTimeUpdate={() => { if (!isPremium) setCurrentTime(audioRef.current?.currentTime || 0); }}
                onLoadedMetadata={() => { if (!isPremium && audioRef.current) setDuration(audioRef.current.duration || 30); }}
                onError={(e) => { console.error('Audio error', e); setError('Audio error'); }}
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
                                onChange={handleSearchChange}
                                className="search-input"
                            />
                            {loading && <span className="search-loading">Searching...</span>}
                        </div>
                    </div>
                    <div className="header-right">
                        <Image
                            src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center'}
                            alt={currentUser.name}
                            className="user-avatar"
                            width={48}
                            height={48}
                        />
                        <span className="user-name">{currentUser.name} {isPremium ? '(Premium)' : '(Free)'}</span>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <div className="main-layout">
                <aside className="sidebar">
                    <nav className="nav-menu">
                        <button onClick={() => setActiveTab('home')} className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}><Home className="nav-icon" /><span>Home</span></button>
                        <button onClick={() => setActiveTab('search')} className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}><Search className="nav-icon" /><span>Search</span></button>
                        <button onClick={() => setActiveTab('playlists')} className={`nav-item ${activeTab === 'playlists' ? 'active' : ''}`}><Music className="nav-icon" /><span>My Playlists</span></button>
                    </nav>

                    <div className="quick-playlists">
                        <h3 className="quick-title">Quick Playlists</h3>
                        <div className="playlist-list">
                            {playlists.slice(0, 3).map(pl => (
                                <div key={pl.id} className="playlist-item" onClick={() => openPlaylist(pl)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openPlaylist(pl)}>
                                    <Image src={pl.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={pl.name} width={80} height={80} className="playlist-cover" />
                                    <div className="playlist-info">
                                        <p className="playlist-name">{pl.name}</p>
                                        <p className="playlist-count">{pl.songs.length} songs</p>
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
                                        {accessToken && (
                                            <div style={{
                                                padding: '20px',
                                                background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
                                                borderRadius: '12px',
                                                margin: '20px 0',
                                                textAlign: 'center'
                                            }}>
                                                <h3 style={{ color: 'white', marginBottom: '10px' }}>🎵 Load Your Spotify Library</h3>
                                                <button onClick={loadSpotifyData} disabled={loading} style={{
                                                    padding: '12px 28px', background: '#fff', color: '#1DB954', borderRadius: '24px', border: 'none', fontWeight: '700'
                                                }}>
                                                    {loading ? '⏳ Loading...' : '📥 Load My Music from Spotify'}
                                                </button>
                                                <p style={{ color: 'rgba(255,255,255,0.9)', marginTop: '10px', fontSize: '13px' }}>Click to load your personalized top tracks and playlists from Spotify</p>
                                            </div>
                                        )}

                                        <div className="featured-songs">
                                            {songs.map(song => (
                                                <div key={song.id} className="song-card" onClick={() => selectSong(song)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}>
                                                    <div className="song-cover-container">
                                                        <Image src={song.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={song.title} width={200} height={200} className="song-cover" />
                                                        <button className="play-overlay"><Play className="play-icon" /></button>
                                                    </div>
                                                    <h3 className="song-title">{song.title}</h3>
                                                    <p className="song-artist">{song.artist}</p>
                                                    <Heart className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="recent-section">
                                            <h3 className="section-title">Recently Played</h3>
                                            <div className="recent-list">
                                                {recentlyPlayed.slice(0, 6).map(s => (
                                                    <div key={s.id} className="recent-item" onClick={() => selectSong(s)} role="button" tabIndex={0}>
                                                        <Image src={s.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={s.title} width={80} height={80} className="recent-cover" />
                                                        <div className="recent-info">
                                                            <h4 className="recent-title">{s.title}</h4>
                                                            <p className="recent-artist">{s.artist} • {s.album}</p>
                                                        </div>
                                                        <span className="recent-duration">{s.duration}</span>
                                                        <button className="recent-play" onClick={(e) => { e.stopPropagation(); selectSong(s); }}><Play /></button>
                                                        <Heart className={`heart-icon ${likedSongs.has(s.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(s.id); }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="recommendations-section">
                                            <h3 className="section-title">Recommended For You</h3>
                                            <div className="featured-songs">
                                                {recommendations.map(r => (
                                                    <div key={r.id} className="song-card" onClick={() => selectSong(r)} role="button" tabIndex={0}>
                                                        <div className="song-cover-container">
                                                            <Image src={r.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={r.title} width={200} height={200} />
                                                            <button className="play-overlay"><Play /></button>
                                                        </div>
                                                        <h3 className="song-title">{r.title}</h3>
                                                        <p className="song-artist">{r.artist}</p>
                                                        <Heart className={`heart-icon ${likedSongs.has(r.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(r.id); }} />
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
                                        {artists.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : filteredSongs.length > 0 ? (
                                <div className="search-results">
                                    {filteredSongs.map(song => (
                                        <div key={song.id} className="search-item" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && selectSong(song)}>
                                            <Image src={song.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={song.title} width={80} height={80} className="search-cover" onClick={() => selectSong(song)} />
                                            <div className="search-info" onClick={() => selectSong(song)}>
                                                <h4 className="search-title">{song.title}</h4>
                                                <p className="search-artist">{song.artist} • {song.album}</p>
                                                <p className="search-genre">{song.genre}</p>
                                            </div>
                                            <div className="search-actions">
                                                <span className="search-duration">{song.duration}</span>
                                                <button className="add-playlist-btn" onClick={(e) => { e.stopPropagation(); setSelectedSongForPlaylist(song); setShowAddToPlaylist(true); }}>
                                                    <Plus />
                                                </button>
                                                <Heart className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} />
                                                <button className="search-play" onClick={() => selectSong(song)}><Play /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-search"><Search /><p className="empty-text">{searchQuery ? 'No songs found' : 'Use filters to browse songs or search above'}</p></div>
                            )}
                        </div>
                    )}

                    {activeTab === 'playlists' && (
                        <div className="playlists-content">
                            <div className="playlists-header">
                                <h2 className="page-title">My Playlists</h2>
                                <button onClick={() => setShowCreatePlaylist(true)} className="create-playlist-btn"><Plus /> <span>Create Playlist</span></button>
                            </div>

                            {showCreatePlaylist && (
                                <div className="create-playlist-form">
                                    <h3 className="form-title">Create New Playlist</h3>
                                    <div className="form-controls">
                                        <input type="text" placeholder="Playlist name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} className="playlist-input" />
                                        <button onClick={createPlaylist} className="create-btn">Create</button>
                                        <button onClick={() => setShowCreatePlaylist(false)} className="cancel-btn">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : (
                                <div className="playlists-grid">
                                    {playlists.map(pl => (
                                        <div key={pl.id} className="playlist-card" onClick={() => openPlaylist(pl)} role="button" tabIndex={0}>
                                            <Image src={pl.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={pl.name} width={200} height={200} className="playlist-card-cover" />
                                            <div className="playlist-card-overlay">
                                                <button className="playlist-play-btn" onClick={(e) => { e.stopPropagation(); playAllSongs(pl.songs); }}><Play /></button>
                                            </div>
                                            <h3 className="playlist-card-name">{pl.name}</h3>
                                            <p className="playlist-card-count">{pl.songs.length} songs</p>
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
                                    <Image src={selectedPlaylist.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={selectedPlaylist.name} width={200} height={200} className="playlist-detail-cover" />
                                    <div className="playlist-header-info">
                                        <h2 className="playlist-detail-title">{selectedPlaylist.name}</h2>
                                        <p className="playlist-detail-count">{selectedPlaylist.songs.length} songs</p>
                                        {selectedPlaylist.songs.length > 0 && <button onClick={() => playAllSongs(selectedPlaylist.songs)} className="play-all-btn"><Play /> Play All</button>}
                                    </div>
                                </div>
                            </div>

                            <div className="playlist-songs-list">
                                {selectedPlaylist.songs.length === 0 ? (
                                    <div className="empty-playlist"><Music /><p className="empty-text">No songs in this playlist yet</p><button onClick={() => setActiveTab('search')} className="browse-btn">Browse Songs</button></div>
                                ) : (
                                    selectedPlaylist.songs.map((song, idx) => (
                                        <div key={song.id} className="playlist-song-item" onClick={() => selectSong(song, selectedPlaylist.songs)} role="button" tabIndex={0}>
                                            <span className="song-number">{idx + 1}</span>
                                            <Image src={song.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={song.title} width={60} height={60} className="playlist-song-cover" />
                                            <div className="playlist-song-info"><h4 className="playlist-song-title">{song.title}</h4><p className="playlist-song-artist">{song.artist}</p></div>
                                            <span className="playlist-song-album">{song.album}</span>
                                            <span className="playlist-song-duration">{song.duration}</span>
                                            <button className="playlist-song-play" onClick={(e) => { e.stopPropagation(); selectSong(song); }}><Play /></button>
                                            <Heart className={`heart-icon ${likedSongs.has(song.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} />
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
                            {playlists.map(pl => (
                                <button key={pl.id} onClick={() => addSongToPlaylist(pl.id)} className="modal-playlist-item">
                                    <Image src={pl.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={pl.name} width={50} height={50} />
                                    <span className="modal-playlist-name">{pl.name}</span>
                                    <span className="modal-playlist-count">{pl.songs.length} songs</span>
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
                            <Image src={currentSong.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'} alt={currentSong.title} width={80} height={80} className="player-cover" />
                            <div className="player-info">
                                <h4 className="player-title">{currentSong.title}</h4>
                                <p className="player-artist">{currentSong.artist}</p>
                                {(!isPremium || !currentSong.spotify_uri) && currentSong.preview_url && <p className="player-note">Preview</p>}
                            </div>
                        </div>

                        <div className="player-controls">
                            <button className={`control-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}><Shuffle /></button>
                            <button className="control-btn" onClick={playPrevious}><SkipBack /></button>
                            <button onClick={togglePlayPause} className="play-btn">
                                {isPlaying ? <Pause className="play-icon" /> : <Play className="play-icon" />}
                            </button>
                            <button className="control-btn" onClick={playNext}><SkipForward /></button>
                            <button className={`control-btn ${repeat !== 'off' ? 'active' : ''}`} onClick={toggleRepeat}><Repeat />{repeat === 'one' && <span className="repeat-indicator">1</span>}</button>
                        </div>

                        <div className="player-right">
                            <Heart className={`heart-btn ${likedSongs.has(currentSong.id) ? 'liked' : ''}`} onClick={() => toggleLike(currentSong.id)} />
                            <div className="volume-controls">
                                <Volume2 />
                                <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="volume-slider" />
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
                            <div className="progress-fill" style={{ width: `${(duration ? (currentTime / duration) * 100 : 0)}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
