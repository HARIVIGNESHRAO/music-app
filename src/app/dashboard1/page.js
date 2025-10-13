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

// Static songs data (centralized)
const staticSongs = [
    { id: 1, title: "Midnight Dreams", artist: "Luna Martinez", album: "Nocturnal Vibes", duration: "3:24", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center", genre: "Pop", plays: 1234567, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", spotify_uri: null },
    { id: 2, title: "Electric Pulse", artist: "Neon Collective", album: "Digital Horizons", duration: "4:12", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop&crop=center", genre: "Electronic", plays: 987654, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", spotify_uri: null },
    { id: 3, title: "Acoustic Soul", artist: "River Stone", album: "Unplugged Sessions", duration: "2:58", cover: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=300&h=300&fit=crop&crop=center", genre: "Acoustic", plays: 756432, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", spotify_uri: null },
    { id: 4, title: "Urban Rhythm", artist: "City Beats", album: "Street Anthology", duration: "3:45", cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=300&fit=crop&crop=center", genre: "Hip-Hop", plays: 2143567, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", spotify_uri: null },
    { id: 5, title: "Sunset Boulevard", artist: "Golden Hour", album: "California Dreams", duration: "4:33", cover: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop&crop=center", genre: "Rock", plays: 654321, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", spotify_uri: null },
    { id: 6, title: "Jazz Nights", artist: "Smooth Operators", album: "After Hours", duration: "5:12", cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop&crop=center", genre: "Jazz", plays: 543210, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", spotify_uri: null },
    { id: 7, title: "Classical Morning", artist: "Orchestra Symphony", album: "Dawn Collection", duration: "6:45", cover: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&h=300&fit=crop&crop=center", genre: "Classical", plays: 432109, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", spotify_uri: null },
    { id: 8, title: "Country Roads", artist: "Nashville Stars", album: "Southern Tales", duration: "3:56", cover: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop&crop=center", genre: "Country", plays: 321098, preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", spotify_uri: null }
];

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
    const [editingSong, setEditingSong] = useState(null);
    const [artists, setArtists] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState(null);
    const audioRef = useRef(null);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('off');
    const [isLoadingSong, setIsLoadingSong] = useState(false);
    const [likedSongs, setLikedSongs] = useState(new Set());
    const [recentlyPlayed, setRecentlyPlayed] = useState([]);
    const [isPremium, setIsPremium] = useState(false);
    const [spotifyPlayer, setSpotifyPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const searchTimerRef = useRef(null);
    const isLoadingRef = useRef(false);
    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net';

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

    const generateRecommendations = useCallback((allSongs) => {
        if (!allSongs || allSongs.length === 0) {
            setRecommendations([]);
            return;
        }

        const allGenres = [...new Set(allSongs.map(song => song.genre))];
        const allArtists = [...new Set(allSongs.map(song => song.artist))];

        const createFeatureVector = (song) => {
            const genreVector = allGenres.map(genre => song.genre === genre ? 1 : 0);
            const artistVector = allArtists.map(artist => song.artist === artist ? 1 : 0);
            const maxPlays = Math.max(...allSongs.map(s => s.plays), 1);
            const plays = song.plays / maxPlays;
            return [...genreVector, ...artistVector, plays];
        };

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
        };

        const songVectors = allSongs.map(song => ({
            song,
            vector: createFeatureVector(song)
        }));

        const userPreferenceSongs = [
            ...recentlyPlayed,
            ...Array.from(likedSongs).map(songId => allSongs.find(s => s.id === songId)).filter(s => s)
        ].filter((song, index, self) => song && self.findIndex(s => s.id === song.id) === index);

        if (userPreferenceSongs.length === 0) {
            const shuffled = [...allSongs].sort(() => 0.5 - Math.random());
            setRecommendations(shuffled.slice(0, 4));
            return;
        }

        const userVectors = userPreferenceSongs.map(song => createFeatureVector(song));
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
            .filter(song => !userPreferenceSongs.some(s => s.id === song.id))
            .slice(0, 4);

        setRecommendations(recommendedSongs);
    }, [recentlyPlayed, likedSongs]);

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedTracks = getCachedData(CACHE_KEY_TOP_TRACKS);
            if (cachedTracks) {
                setSongs(cachedTracks);
                generateRecommendations(cachedTracks);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            const response = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=10&fields=items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity)',
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
                cover: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
                genre: 'Unknown',
                plays: track.popularity * 10000,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri,
            }));

            setSongs(mappedSongs);
            setCachedData(CACHE_KEY_TOP_TRACKS, mappedSongs);
            generateRecommendations(mappedSongs);
        } catch (err) {
            console.error('Failed to fetch tracks:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to fetch tracks');
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
                return;
            }

            const playlistsResponse = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/playlists?limit=5&fields=items(id,name,tracks.href,images)',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            const playlistsWithSongs = [];
            const MAX_PLAYLISTS = 5;
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
                            cover: item.track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
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
                            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
                    });
                } catch (err) {
                    console.error(`Error fetching tracks for playlist ${playlist.name}:`, err);
                    if (err.response?.status === 429) continue;
                    playlistsWithSongs.push({
                        id: playlist.id,
                        name: playlist.name,
                        songs: [],
                        cover: playlist.images?.[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
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
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (!accessToken || !query) {
            const filtered = staticSongs.filter(song =>
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
                setError(null);
                const response = await apiCallWithBackoff(() =>
                    axios.get(
                        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&fields=tracks(items(id,name,artists(name),album(name,images),duration_ms,preview_url,uri,popularity))`,
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
                    cover: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
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
                    cover: data.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center'
                }]);
                setNewPlaylistName('');
                setShowCreatePlaylist(false);
                setError(null);
            } catch (err) {
                console.error('Failed to create playlist:', err);
                setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to create playlist');
            }
        } else {
            const newPlaylist = {
                id: Date.now(),
                name: newPlaylistName,
                songs: [],
                cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
            };
            setPlaylists(prev => [...prev, newPlaylist]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
            setError(null);
        }
    };

    const isSongPlayable = useCallback((song) => {
        if (!song) return false;
        if (song.preview_url) return true;
        if (song.spotify_uri && isPremium && playerReady) return true;
        return false;
    }, [isPremium, playerReady]);

    const selectSong = useCallback(async (song, songList = null) => {
        // Prevent multiple simultaneous song selections
        if (isLoadingRef.current) {
            console.log("Already loading a song, ignoring duplicate call");
            return;
        }

        console.log("Selecting song:", song.title, "hasPreview:", !!song.preview_url, "hasUri:", !!song.spotify_uri);

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

        // Reset the loading flag after a short delay
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

    const fetchUsers = useCallback(async () => {
        try {
            setUsersLoading(true);
            setUsersError(null);
            const { data } = await axios.get(`${BACKEND_URL}/api/users`);
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setUsersError('Failed to load users from server');
        } finally {
            setUsersLoading(false);
        }
    }, [BACKEND_URL]);
    const fetchUserProfile = useCallback(async (token) => {
        // Prevent multiple calls
        if (profileLoadedRef.current) {
            console.log('Profile already loaded, skipping...');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            console.log('Fetching user profile...');

            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = {
                id: data.id,
                name: data.display_name,
                email: data.email,
                avatar: data.images?.[0]?.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center',
                role: data.email === 'admin@music.com' ? 'admin' : 'user',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsAdmin(user.role === 'admin');
            setIsPremium(user.product === 'premium');
            window.localStorage.setItem('user', JSON.stringify(user));

            // Mark profile as loaded
            profileLoadedRef.current = true;

            console.log('Profile loaded:', user.name);

            // Initialize with static songs
            setSongs(staticSongs);
            setFilteredSongs(staticSongs);
            generateRecommendations(staticSongs);

            const uniqueArtists = [...new Set(staticSongs.map(song => song.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: staticSongs.filter(s => s.artist === name).length,
                albums: new Set(staticSongs.filter(s => s.artist === name).map(s => s.album)).size
            })));

            setPlaylists([
                { id: 1, name: 'My Favorites', songs: [staticSongs[0], staticSongs[2]], cover: staticSongs[0].cover },
                { id: 2, name: 'Workout Mix', songs: [staticSongs[1], staticSongs[3]], cover: staticSongs[1].cover },
                { id: 3, name: 'Chill Vibes', songs: [staticSongs[2], staticSongs[4], staticSongs[5]], cover: staticSongs[2].cover }
            ]);

            console.log('Spotify tracks available on demand');
        } catch (err) {
            console.error('Profile fetch error:', err);
            setError(
                err.response?.status === 429
                    ? 'Too many requests. Please wait and try again.'
                    : `Failed to fetch profile: ${err.response?.data?.error?.message || err.message}`
            );
        } finally {
            setLoading(false);
        }
    }, [generateRecommendations]);

    const loadSpotifyData = useCallback(async () => {
        if (!accessToken) return;

        setLoading(true);
        setError(null);

        try {
            console.log('📥 Loading Spotify tracks...');
            await fetchTopTracks(accessToken);

            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('📥 Loading playlists...');
            await fetchUserPlaylists(accessToken);

            setError('Spotify library loaded successfully!');
            setTimeout(() => setError(null), 3000);

        } catch (err) {
            console.error('❌ Failed to load Spotify data:', err);
            setError(err.response?.status === 429
                ? 'Too many requests. Please try again in a moment.'
                : 'Failed to load Spotify data');
        } finally {
            setLoading(false);
        }
    }, [accessToken, fetchTopTracks, fetchUserPlaylists]);

    useEffect(() => {
        const storedUser = window.localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            setIsAdmin(user.role === 'admin');
            setIsPremium(user.product === 'premium');
            profileLoadedRef.current = true; // Mark as loaded from cache

            setSongs(staticSongs);
            setFilteredSongs(staticSongs);

            const uniqueArtists = [...new Set(staticSongs.map(song => song.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: staticSongs.filter(s => s.artist === name).length,
                albums: new Set(staticSongs.filter(s => s.artist === name).map(s => s.album)).size
            })));

            setPlaylists([
                { id: 1, name: 'My Favorites', songs: [staticSongs[0], staticSongs[2]], cover: staticSongs[0].cover },
                { id: 2, name: 'Workout Mix', songs: [staticSongs[1], staticSongs[3]], cover: staticSongs[1].cover },
                { id: 3, name: 'Chill Vibes', songs: [staticSongs[2], staticSongs[4], staticSongs[5]], cover: staticSongs[2].cover }
            ]);

            generateRecommendations(staticSongs);
        }

        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken && !profileLoadedRef.current) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile, generateRecommendations]);

    useEffect(() => {
        if (activeTab === 'admin' && isAdmin && users.length === 0) {
            fetchUsers();
        }
    }, [activeTab, isAdmin, users.length, fetchUsers]);

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
                    setSpotifyPlayer(playerInstance);
                    setPlayerReady(true);
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
                            duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                            cover: track.album.images[0]?.url || 'default-cover',
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
        if (spotifyPlayer) {
            spotifyPlayer.setVolume(volume / 100).catch(err =>
                console.error('Failed to set volume:', err)
            );
        }
    }, [volume, spotifyPlayer]);

    useEffect(() => {
        if (!currentSong) return;

        let isCancelled = false;
        let retryTimeout = null;

        const playSong = async () => {
            // CRITICAL FIX: Check and set in one atomic operation
            if (isLoadingRef.current) {
                console.log("Already loading song, skipping duplicate playback attempt");
                return;
            }
            isLoadingRef.current = true;

            try {
                setIsLoadingSong(true);
                setError(null);

                // Spotify Premium playback
                if (isPremium && playerReady && deviceId && currentSong.spotify_uri) {
                    try {
                        await apiCallWithBackoff(() =>
                            axios.put(
                                `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                                { uris: [currentSong.spotify_uri] },
                                { headers: { Authorization: `Bearer ${accessToken}` } }
                            )
                        );
                        console.log("Playing via Spotify SDK");

                        if (!isCancelled) {
                            setRecentlyPlayed((prev) => {
                                const newPlayed = [currentSong, ...prev.filter((s) => s.id !== currentSong.id)];
                                return newPlayed.slice(0, 5);
                            });
                        }
                        return;
                    } catch (sdkError) {
                        if (sdkError.response?.status === 429) {
                            const retryAfter = parseInt(sdkError.response.headers["retry-after"] || "10", 10) * 1000;
                            console.warn(`Rate limited. Retrying after ${retryAfter}ms...`);
                            if (!isCancelled) {
                                retryTimeout = setTimeout(playSong, retryAfter + Math.random() * 100);
                            }
                            return;
                        }
                        console.warn("SDK failed, trying preview:", sdkError.message);
                    }
                }

                // Fallback to preview playback
                if (audioRef.current && currentSong.preview_url) {
                    console.log("Attempting preview playback...");
                    const audio = audioRef.current;

                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = currentSong.preview_url;

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

                        audio.load();
                    });

                    if (!isCancelled && isPlaying) {
                        await audio.play();
                        console.log("Preview playing");
                        setError(null);
                        setRecentlyPlayed((prev) => {
                            const newPlayed = [currentSong, ...prev.filter((s) => s.id !== currentSong.id)];
                            return newPlayed.slice(0, 5);
                        });
                    }
                    return;
                }

                // No playback method available
                if (!isCancelled) {
                    if (isPremium && currentSong.spotify_uri && !playerReady) {
                        setError("Player is initializing. Please wait.");
                    } else if (!currentSong.preview_url && !currentSong.spotify_uri) {
                        setError(`No playable content for ${currentSong.title}`);
                    } else if (currentSong.spotify_uri && !currentSong.preview_url && !isPremium) {
                        setError(`${currentSong.title} requires Spotify Premium`);
                    } else {
                        console.error("Playback failed despite available content");
                        setError(`Failed to play ${currentSong.title}`);
                    }
                    setIsPlaying(false);
                }
            } catch (err) {
                if (!isCancelled) {
                    if (err.name === "AbortError") {
                        console.log("Playback was interrupted");
                    } else if (err.name === "NotAllowedError") {
                        setError("Playback blocked. Please click play to start.");
                        setIsPlaying(false);
                    } else if (err.response?.status === 429) {
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
                    isLoadingRef.current = false; // CRITICAL: Reset here too
                }
            }
        };

        playSong(); // Always call, the guard is inside

        return () => {
            isCancelled = true;
            isLoadingRef.current = false; // Reset on cleanup
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [currentSong?.id, isPremium, playerReady, deviceId, accessToken, isPlaying]);

    useEffect(() => {
        if (!audioRef.current || isPremium) return;

        const audio = audioRef.current;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
        const handleLoadedMetadata = () => setDuration(audio.duration || 30);
        const handleError = (e) => {
            console.error('Audio error:', e);
            setError('Error loading audio file');
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);

        if (isPlaying && !isLoadingSong) {
            audio.play().catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('Play error:', err);
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
        setIsAdmin(false);
        setIsPremium(false);
        setCurrentSong(null);
        setIsPlaying(false);
        setActiveTab('home');
        setSongs([]);
        setFilteredSongs([]);
        setPlaylists([]);
        setUsers([]);
        setQueue([]);
        setCurrentIndex(0);
        setRecentlyPlayed([]);
        setSpotifyPlayer(null);
        setDeviceId(null);
        setPlayerReady(false);

        // Reset the profile loaded flag
        profileLoadedRef.current = false;

        window.localStorage.removeItem('spotify_token');
        window.localStorage.removeItem('spotify_code_verifier');
        window.localStorage.removeItem('user');
        router.push('/login');
    };

    const togglePlay = () => {
        if (isPremium && spotifyPlayer && playerReady) {
            if (isPlaying) {
                spotifyPlayer.pause();
            } else {
                spotifyPlayer.resume();
            }
        } else {
            setIsPlaying(prev => !prev);
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
        if (isPremium && spotifyPlayer && deviceId && duration) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const seekTime = (clickX / width) * duration * 1000;

            try {
                await spotifyPlayer.seek(seekTime);
                setCurrentTime(seekTime / 1000);
            } catch (err) {
                console.error('Failed to seek:', err);
                setError('Failed to seek track');
            }
        } else if (audioRef.current && duration) {
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
        // DO NOT call fetchUserProfile here
    };

    const deleteSong = (songId) => {
        if (window.confirm('Are you sure you want to delete this song?')) {
            setSongs(prev => prev.filter(song => song.id !== songId));
            setFilteredSongs(prev => prev.filter(song => song.id !== songId));
            setPlaylists(prev => prev.map(playlist => ({
                ...playlist,
                songs: playlist.songs.filter(song => song.id !== songId)
            })));
        }
    };

    const startEditSong = (song) => setEditingSong({ ...song });

    const saveEditSong = () => {
        if (!editingSong) return;

        setSongs(prev => prev.map(song => song.id === editingSong.id ? editingSong : song));
        setFilteredSongs(prev => prev.map(song => song.id === editingSong.id ? editingSong : song));
        setPlaylists(prev => prev.map(playlist => ({
            ...playlist,
            songs: playlist.songs.map(song => song.id === editingSong.id ? editingSong : song)
        })));
        setEditingSong(null);
    };

    const deleteArtist = (artistName) => {
        if (window.confirm(`Are you sure you want to delete ${artistName} and all their songs?`)) {
            setSongs(prev => prev.filter(song => song.artist !== artistName));
            setFilteredSongs(prev => prev.filter(song => song.artist !== artistName));
            setArtists(prev => prev.filter(artist => artist.name !== artistName));
            setPlaylists(prev => prev.map(playlist => ({
                ...playlist,
                songs: playlist.songs.filter(song => song.artist !== artistName)
            })));
        }
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
            <audio
                ref={audioRef}
                onTimeUpdate={() => !isPremium && setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => {
                    if (!isPremium && audioRef.current) {
                        setDuration(audioRef.current.duration || 30);
                    }
                }}
                onError={(e) => {
                    console.error('Audio error:', e);
                    setError('Error loading audio file');
                }}
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
                            {loading && <span className="search-loading">Searching...</span>}
                        </div>
                    </div>
                    <div className="header-right">
                        <Image
                            src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center'}
                            alt={currentUser.username || currentUser.name}
                            className="user-avatar"
                            width={100}
                            height={100}
                            priority
                        />
                        <span className="user-name">{currentUser.username || currentUser.name} {isPremium ? '(Premium)' : '(Free)'}</span>
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
                                <h2 className="welcome-title">Welcome back, {currentUser.username || currentUser.name}!</h2>
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
                                            <p className="stat-value">{songs.reduce((sum, song) => sum + song.plays, 0).toLocaleString()}</p>
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
                                {usersLoading ? (
                                    <p>Loading users from server...</p>
                                ) : usersError ? (
                                    <div className="error-section">
                                        <p className="error-text">{usersError}</p>
                                        <button onClick={fetchUsers} className="retry-btn">Retry</button>
                                    </div>
                                ) : users.length === 0 ? (
                                    <p>No users found</p>
                                ) : (
                                    <div className="user-list">
                                        {users.map((user) => (
                                            <div key={user._id} className="user-item">
                                                <div className="user-left">
                                                    <div className="user-icon"><User className="user-icon-svg" /></div>
                                                    <div className="user-details">
                                                        <p className="user-item-name">{user.username}</p>
                                                        <p className="user-email">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="user-right">
                                                    <span className={`role-badge ${user.role}`}>{user.role}</span>
                                                    <span className="join-date">{formatDate(user.joinDate)}</span>
                                                    <button className="user-menu"><MoreVertical className="menu-icon" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="admin-panel">
                                <h3 className="panel-title">Songs Management</h3>
                                {editingSong ? (
                                    <div className="edit-song-form">
                                        <h4 className="form-title">Edit Song</h4>
                                        <div className="form-grid">
                                            <input
                                                type="text"
                                                placeholder="Song Title"
                                                value={editingSong.title}
                                                onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                                                className="form-input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Artist"
                                                value={editingSong.artist}
                                                onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                                                className="form-input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Album"
                                                value={editingSong.album}
                                                onChange={(e) => setEditingSong({ ...editingSong, album: e.target.value })}
                                                className="form-input"
                                            />
                                            <select
                                                value={editingSong.genre}
                                                onChange={(e) => setEditingSong({ ...editingSong, genre:e.target.value })}
                                                className="form-select"
                                            >
                                                <option value="Pop">Pop</option><option value="Electronic">Electronic</option><option value="Acoustic">Acoustic</option>
                                                <option value="Hip-Hop">Hip-Hop</option><option value="Rock">Rock</option><option value="Jazz">Jazz</option>
                                                <option value="Classical">Classical</option><option value="Country">Country</option>
                                            </select>
                                        </div>
                                        <div className="form-actions">
                                            <button onClick={saveEditSong} className="save-btn">Save Changes</button>
                                            <button onClick={() => setEditingSong(null)} className="cancel-btn">Cancel</button>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="songs-list">
                                    {songs.map((song) => (
                                        <div key={song.id} className="admin-song-item">
                                            <Image
                                                src={song.cover}
                                                alt={song.title}
                                                className="admin-song-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="admin-song-info">
                                                <h4 className="admin-song-title">{song.title}</h4>
                                                <p className="admin-song-artist">{song.artist} • {song.album}</p>
                                                <p className="admin-song-genre">{song.genre} • {song.plays.toLocaleString()} plays</p>
                                            </div>
                                            <div className="admin-song-actions">
                                                <button onClick={() => startEditSong(song)} className="edit-btn">Edit</button>
                                                <button onClick={() => deleteSong(song.id)} className="delete-btn">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="admin-panel">
                                <h3 className="panel-title">Artists Management</h3>
                                <div className="artists-grid">
                                    {artists.map((artist) => (
                                        <div key={artist.id} className="artist-card">
                                            <div className="artist-icon-circle"><User className="artist-icon" /></div>
                                            <h4 className="artist-name">{artist.name}</h4>
                                            <p className="artist-stats">{artist.songs} songs • {artist.albums} albums</p>
                                            <button onClick={() => deleteArtist(artist.name)} className="delete-artist-btn">Remove</button>
                                        </div>
                                    ))}
                                </div>
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
                            <button onClick={togglePlay} className="play-btn">
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