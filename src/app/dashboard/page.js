'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, Users, BarChart3, Shield
} from 'lucide-react';
import crypto from 'crypto-js';
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

    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net';

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

    const generateCodeVerifier = () => crypto.lib.WordArray.random(32).toString(crypto.enc.Base64url);
    const generateCodeChallenge = (verifier) => crypto.SHA256(verifier).toString(crypto.enc.Base64url);

    // Initialize Spotify Web Playback SDK
    useEffect(() => {
        if (!accessToken || !isPremium) return;

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'MusicStream Web Player',
                getOAuthToken: cb => { cb(accessToken); },
                volume: volume / 100
            });

            player.addListener('ready', ({ device_id }) => {
                console.log('Spotify Player ready with Device ID', device_id);
                setDeviceId(device_id);
                setSpotifyPlayer(player);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setDeviceId(null);
            });

            player.addListener('player_state_changed', (state) => {
                if (!state) return;
                setIsPlaying(!state.paused);
                setCurrentTime(state.position / 1000);
                setDuration(state.duration / 1000);
                if (state.track_window.current_track) {
                    const track = state.track_window.current_track;
                    setCurrentSong({
                        id: track.id,
                        title: track.name,
                        artist: track.artists.map(a => a.name).join(', '),
                        album: track.album.name,
                        duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                        cover: track.album.images[0]?.url || 'default-cover',
                        genre: 'Unknown',
                        plays: 0,
                        spotify_uri: track.uri
                    });
                    setRecentlyPlayed(prev => {
                        const newPlayed = [{ ...track, id: track.id, title: track.name, artist: track.artists.map(a => a.name).join(', '), album: track.album.name, duration: new Date(track.duration_ms).toISOString().substr(14, 5), cover: track.album.images[0]?.url, genre: 'Unknown', plays: 0, spotify_uri: track.uri }, ...prev.filter(s => s.id !== track.id)];
                        return newPlayed.slice(0, 5);
                    });
                    generateRecommendations(songs);
                }
            });

            player.connect();
            return () => {
                player.disconnect();
                document.body.removeChild(script);
            };
        };
    }, [accessToken, isPremium, volume, songs]);

    const createFeatureVector = (song, allGenres, allArtists) => {
        const genreVector = allGenres.map(genre => song.genre === genre ? 1 : 0);
        const artistVector = allArtists.map(artist => song.artist === artist ? 1 : 0);
        const maxPlays = Math.max(...staticSongs.map(s => s.plays));
        const plays = song.plays / maxPlays;
        return [...genreVector, ...artistVector, plays];
    };

    const cosineSimilarity = (vecA, vecB) => {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
    };

    const generateRecommendations = (allSongs) => {
        if (!allSongs || allSongs.length === 0) {
            setRecommendations([]);
            return;
        }

        const allGenres = [...new Set(allSongs.map(song => song.genre))];
        const allArtists = [...new Set(allSongs.map(song => song.artist))];

        const songVectors = allSongs.map(song => ({
            song,
            vector: createFeatureVector(song, allGenres, allArtists)
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

        const userVectors = userPreferenceSongs.map(song => createFeatureVector(song, allGenres, allArtists));
        const userVector = userVectors.reduce((avg, vec) => avg.map((val, i) => val + vec[i] / userVectors.length), new Array(allGenres.length + allArtists.length + 1).fill(0));

        const scores = songVectors.map(({ song, vector }) => ({
            song,
            score: cosineSimilarity(userVector, vector)
        }));

        const recommendations = scores
            .sort((a, b) => b.score - a.score)
            .map(item => item.song)
            .filter(song => !userPreferenceSongs.some(s => s.id === song.id))
            .slice(0, 4);

        setRecommendations(recommendations);
    };

    const fetchUsers = useCallback(async () => {
        try {
            setUsersLoading(true);
            setUsersError(null);
            const { data } = await axios.get(`${BACKEND_URL}/api/users`);
            console.log('Fetched users from backend:', data);
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setUsersError('Failed to load users from server');
        } finally {
            setUsersLoading(false);
        }
    }, [BACKEND_URL]);

    const fetchTopTracks = useCallback(async (token) => {
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=20', { headers: { Authorization: `Bearer ${token}` } });
            const mappedSongs = data.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || 'default-cover',
                genre: 'Unknown',
                plays: track.popularity * 10000,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri
            }));
            setSongs(mappedSongs);
            generateRecommendations(mappedSongs);
        } catch (err) { setError('Failed to fetch tracks'); }
    }, []);
    const fetchUserPlaylists = useCallback(async (token) => {
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me/playlists?limit=10', { headers: { Authorization: `Bearer ${token}` } });
            const playlistsWithSongs = await Promise.all(data.items.map(async (playlist) => {
                try {
                    const tracksData = await axios.get(playlist.tracks.href, { headers: { Authorization: `Bearer ${token}` } });
                    const songs = tracksData.data.items
                        .filter(item => item.track && item.track.id) // Filter out null tracks
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
                            spotify_uri: item.track.uri
                        }));
                    // Use playlist cover or first song's cover as fallback
                    const coverImage = playlist.images?.[0]?.url ||
                        songs[0]?.cover ||
                        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center';
                    return { id: playlist.id, name: playlist.name, songs, cover: coverImage };
                } catch (err) {
                    const coverImage = playlist.images?.[0]?.url ||
                        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center';
                    return { id: playlist.id, name: playlist.name, songs: [], cover: coverImage };
                }
            }));
            setPlaylists(playlistsWithSongs);
        } catch (err) { setError('Failed to fetch playlists'); }
    }, []);
    const fetchUserProfile = useCallback(async (token) => {
        try {
            setLoading(true);
            const { data } = await axios.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } });
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
            await Promise.all([fetchTopTracks(token), fetchUserPlaylists(token)]);
        } catch (err) {
            setError('Failed to fetch profile: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [fetchTopTracks, fetchUserPlaylists]);

    useEffect(() => {
        const storedUser = window.localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            setIsAdmin(user.role === 'admin');
            setIsPremium(user.product === 'premium');
            setSongs(staticSongs);
            setFilteredSongs(staticSongs);
            const uniqueArtists = [...new Set(staticSongs.map(song => song.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({ id: idx + 1, name, songs: staticSongs.filter(s => s.artist === name).length, albums: new Set(staticSongs.filter(s => s.artist === name).map(s => s.album)).size })));
            setPlaylists([
                { id: 1, name: "My Favorites", songs: [staticSongs[0], staticSongs[2]], cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center" },
                { id: 2, name: "Workout Mix", songs: [staticSongs[1], staticSongs[3]], cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop&crop=center" },
                { id: 3, name: "Chill Vibes", songs: [staticSongs[2], staticSongs[4], staticSongs[5]], cover: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=300&h=300&fit=crop&crop=center" }
            ]);
            generateRecommendations(staticSongs);
            setActiveTab('home');
            if (user.role === 'admin') {
                fetchUsers();
            }
        }
        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile, fetchUsers]);

    useEffect(() => {
        if (activeTab === 'admin' && isAdmin && users.length === 0) {
            fetchUsers();
        }
    }, [activeTab, isAdmin, users.length, fetchUsers]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume / 100;
        if (spotifyPlayer) spotifyPlayer.setVolume(volume / 100);
    }, [volume, spotifyPlayer]);

    useEffect(() => {
        if (!currentSong) return;

        const playSong = async () => {
            try {
                setIsLoadingSong(true);
                setError(null);

                if (isPremium && spotifyPlayer && deviceId && currentSong.spotify_uri) {
                    // Premium user: Use Spotify Web Playback SDK
                    await axios.put(
                        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                        { uris: [currentSong.spotify_uri] },
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                } else if (audioRef.current && currentSong.preview_url) {
                    // Free user or static song: Use HTML5 audio for preview
                    const audio = audioRef.current;
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = currentSong.preview_url;
                    audio.load();
                    if (isPlaying) {
                        await audio.play();
                    }
                    setRecentlyPlayed(prev => {
                        const newPlayed = [currentSong, ...prev.filter(s => s.id !== currentSong.id)];
                        return newPlayed.slice(0, 5);
                    });
                    generateRecommendations(songs);
                } else {
                    setError('No playable content available');
                    setIsPlaying(false);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('Playback was interrupted, ignoring...');
                } else if (err.name === 'NotAllowedError') {
                    setError('Playback blocked. Please click play to start.');
                    setIsPlaying(false);
                } else if (err.name === 'NotSupportedError') {
                    setError('Audio format not supported.');
                    setIsPlaying(false);
                } else {
                    setError('Failed to play: ' + err.message);
                    setIsPlaying(false);
                }
            } finally {
                setIsLoadingSong(false);
            }
        };

        playSong();

        return () => {
            if (audioRef.current) audioRef.current.pause();
            if (spotifyPlayer && deviceId) {
                axios.put(
                    `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
                    {},
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                ).catch(err => console.error('Failed to pause Spotify player:', err));
            }
        };
    }, [currentSong, isPremium, spotifyPlayer, deviceId, accessToken, isPlaying, songs]);

    useEffect(() => {
        if (!audioRef.current || isPremium) return;
        const audio = audioRef.current;
        if (isPlaying && !isLoadingSong) {
            audio.play().catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('Play error:', err);
                    setIsPlaying(false);
                }
            });
        } else {
            audio.pause();
        }
    }, [isPlaying, isLoadingSong, isPremium]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || isPremium) return;
        const handleEnded = () => {
            if (repeat === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else {
                playNext();
            }
        };
        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [repeat, currentIndex, queue, isPremium]);

    const searchSongs = async (query) => {
        if (!accessToken || !query) {
            const filtered = staticSongs.filter(song => song.title.toLowerCase().includes(query.toLowerCase()) || song.artist.toLowerCase().includes(query.toLowerCase()) || song.album.toLowerCase().includes(query.toLowerCase()));
            setFilteredSongs(filtered);
            return;
        }
        try {
            setLoading(true);
            const { data } = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const mappedSongs = data.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                cover: track.album.images[0]?.url || 'default-cover',
                genre: 'Unknown',
                plays: track.popularity * 10000,
                preview_url: track.preview_url || null,
                spotify_uri: track.uri
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
        window.localStorage.removeItem('spotify_token');
        window.localStorage.removeItem('spotify_code_verifier');
        window.localStorage.removeItem('user');
        router.push('/login');
    };

    const togglePlay = () => {
        if (isPremium && spotifyPlayer && deviceId) {
            if (isPlaying) {
                spotifyPlayer.pause();
            } else {
                spotifyPlayer.resume();
            }
        } else {
            setIsPlaying(!isPlaying);
        }
    };

    const selectSong = async (song, songList = null) => {
        if (!song.preview_url && !song.spotify_uri) {
            setError('No playable content available for this song');
            setCurrentSong(song);
            setIsPlaying(false);
            return;
        }

        if (songList && songList.length > 0) {
            const validSongs = songList.filter(s => s.preview_url || s.spotify_uri);
            setQueue(validSongs);
            const index = validSongs.findIndex(s => s.id === song.id);
            setCurrentIndex(index >= 0 ? index : 0);
        } else if (queue.length === 0) {
            const validSongs = (filteredSongs.length > 0 ? filteredSongs : songs).filter(s => s.preview_url || s.spotify_uri);
            setQueue(validSongs);
            const index = validSongs.findIndex(s => s.id === song.id);
            setCurrentIndex(index >= 0 ? index : 0);
        } else {
            const index = queue.findIndex(s => s.id === song.id);
            if (index >= 0) {
                setCurrentIndex(index);
            }
        }

        setCurrentSong(song);
        setIsPlaying(true);
        setError(null);
    };

    const playNext = () => {
        if (queue.length === 0) return;
        let nextIndex;
        if (shuffle) {
            nextIndex = Math.floor(Math.random() * queue.length);
        } else {
            nextIndex = currentIndex + 1;
            if (nextIndex >= queue.length) {
                if (repeat === 'all') {
                    nextIndex = 0;
                } else {
                    setIsPlaying(false);
                    return;
                }
            }
        }
        setCurrentIndex(nextIndex);
        selectSong(queue[nextIndex]);
    };

    const playPrevious = () => {
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
    };

    const toggleShuffle = () => {
        setShuffle(!shuffle);
    };

    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        const currentModeIndex = modes.indexOf(repeat);
        const nextMode = modes[(currentModeIndex + 1) % modes.length];
        setRepeat(nextMode);
    };

    const toggleLike = (songId) => {
        setLikedSongs(prev => {
            const newLiked = new Set(prev);
            if (newLiked.has(songId)) {
                newLiked.delete(songId);
            } else {
                newLiked.add(songId);
            }
            generateRecommendations(songs);
            return newLiked;
        });
    };

    const handleSeek = async (e) => {
        if (isPremium && spotifyPlayer && deviceId) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const seekTime = (clickX / width) * duration * 1000; // Convert to ms
            try {
                await spotifyPlayer.seek(seekTime);
                setCurrentTime(seekTime / 1000);
            } catch (err) {
                setError('Failed to seek: ' + err.message);
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
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const createPlaylist = async () => {
        if (!newPlaylistName.trim()) return;
        if (accessToken) {
            try {
                const { data } = await axios.post(`https://api.spotify.com/v1/users/${currentUser.id}/playlists`, { name: newPlaylistName, public: true }, { headers: { Authorization: `Bearer ${accessToken}` } });
                setPlaylists(prev => [...prev, { id: data.id, name: data.name, songs: [], cover: data.images[0]?.url || 'default-cover' }]);
                setNewPlaylistName('');
                setShowCreatePlaylist(false);
            } catch (err) {
                setError('Failed to create playlist');
            }
        } else {
            const newPlaylist = { id: playlists.length + 1, name: newPlaylistName, songs: [], cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center" };
            setPlaylists([...playlists, newPlaylist]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query) searchSongs(query);
    };

    const applyFilters = useCallback(() => {
        let filtered = [...songs];
        if (filterGenre !== 'all') filtered = filtered.filter(song => song.genre === filterGenre);
        if (filterArtist !== 'all') filtered = filtered.filter(song => song.artist === filterArtist);
        if (searchQuery) filtered = filtered.filter(song => song.title.toLowerCase().includes(searchQuery.toLowerCase()) || song.artist.toLowerCase().includes(searchQuery.toLowerCase()) || song.album.toLowerCase().includes(searchQuery.toLowerCase()));
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
                if (!songExists) return { ...playlist, songs: [...playlist.songs, selectedSongForPlaylist] };
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

    const deleteSong = (songId) => {
        if (window.confirm('Are you sure you want to delete this song?')) {
            setSongs(prev => prev.filter(song => song.id !== songId));
            setFilteredSongs(prev => prev.filter(song => song.id !== songId));
        }
    };

    const startEditSong = (song) => setEditingSong({ ...song });

    const saveEditSong = () => {
        if (!editingSong) return;
        setSongs(prev => prev.map(song => song.id === editingSong.id ? editingSong : song));
        setFilteredSongs(prev => prev.map(song => song.id === editingSong.id ? editingSong : song));
        setEditingSong(null);
    };

    const deleteArtist = (artistName) => {
        if (window.confirm(`Are you sure you want to delete ${artistName} and all their songs?`)) {
            setSongs(prev => prev.filter(song => song.artist !== artistName));
            setArtists(prev => prev.filter(artist => artist.name !== artistName));
        }
    };

    const playAllSongs = (songList) => {
        if (songList.length === 0) return;
        const validSongs = songList.filter(s => s.preview_url || s.spotify_uri);
        if (validSongs.length === 0) {
            setError('No playable songs in this list');
            return;
        }
        selectSong(validSongs[0], validSongs);
    };

    const formatDate = (dateString) => {
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
                        <button onClick={handleSpotifyLogin} className="login-btn spotify-btn">Login with Spotify</button>
                        <button onClick={() => router.push('/login')} className="login-btn user-btn">Login as User</button>
                        <button onClick={() => router.push('/login')} className="login-btn admin-btn">Login as Admin</button>
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
                onTimeUpdate={() => !isPremium && setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => {
                    if (!isPremium && audioRef.current) setDuration(audioRef.current.duration || 30);
                    else if (!isPremium) setError('Failed to load audio metadata');
                }}
                onEnded={() => {
                    if (!isPremium && repeat === 'one') {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                    } else if (!isPremium) {
                        playNext();
                    }
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
                                <div key={playlist.id} className="playlist-item" onClick={() => openPlaylist(playlist)}>
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
                                        <div className="featured-songs">
                                            {songs.map((song) => (
                                                <div key={song.id} className="song-card" onClick={() => selectSong(song)}>
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
                                                    <div key={song.id} className="recent-item" onClick={() => selectSong(song)}>
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
                                                    <div key={song.id} className="song-card" onClick={() => selectSong(song)}>
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
                                        <div key={song.id} className="search-item">
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
                                        <div key={playlist.id} className="playlist-card" onClick={() => openPlaylist(playlist)}>
                                            <Image
                                                src={playlist.cover}
                                                alt={playlist.name}
                                                className="playlist-card-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="playlist-card-overlay">
                                                <button className="playlist-play-btn" onClick={(e) => { e.stopPropagation(); playAllSongs(playlist.songs); }}>
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
                                        <div key={song.id} className="playlist-song-item" onClick={() => selectSong(song, selectedPlaylist.songs)}>
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
                                                onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
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
                                                onChange={(e) => setEditingSong({ ...editingSong, genre: e.target.value })}
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