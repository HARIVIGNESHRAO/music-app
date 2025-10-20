'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, Users, BarChart3, Shield, Mic,Share2
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [filterGenres, setFilterGenres] = useState([]);
    const [filterArtists, setFilterArtists] = useState([]);
    const [filterPopularity, setFilterPopularity] = useState([0, 10000000]);
    const [allArtists, setAllArtists] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
    const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
    const [editingSong, setEditingSong] = useState(null);
    const [editingPlaylist, setEditingPlaylist] = useState(null); // New state for editing playlists
    const [artists, setArtists] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState(null);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('off');
    const [isLoadingSong, setIsLoadingSong] = useState(false);
    const [likedSongs, setLikedSongs] = useState(new Set());
    const [recentlyPlayed, setRecentlyPlayed] = useState([]);
    const [youtubePlayer, setYoutubePlayer] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const playerRef = useRef(null);
    const youtubePlayerRef = useRef(null);
    const playNextRef = useRef(null);
    const handleStateChangeRef = useRef(null);
    const failedIdsRef = useRef(new Set());
    const currentSongRef = useRef(null);
    const queueRef = useRef([]);
    const currentIndexRef = useRef(0);
    const searchTimerRef = useRef(null);
    const recognitionRef = useRef(null);
    const [searchCache, setSearchCache] = useState({});
    const CACHE_DURATION = 3600000; // 1 hour
    const API_KEY = 'AIzaSyB6C6QO9Yd4IpW3ecaSg7BBY7JalpjDQ6s';
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net';
    const DEFAULT_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center';
    const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center';
    const [sharePlaylist, setSharePlaylist] = useState(null);
    const [shareUrl, setShareUrl] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);

    const AVAILABLE_GENRES = [
        'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Classical', 'Electronic', 'Country', 'R&B', 'Metal', 'Indie'
    ];

    const parseDuration = (iso) => {
        const match = iso.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = parseInt(match?.[1] || 0);
        const mins = parseInt(match?.[2] || 0);
        const secs = parseInt(match?.[3] || 0);
        return hours * 3600 + mins * 60 + secs;
    };

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Load filter preferences from local storage
    useEffect(() => {
        const savedGenres = localStorage.getItem('filterGenres');
        const savedArtists = localStorage.getItem('filterArtists');
        const savedPopularity = localStorage.getItem('filterPopularity');
        if (savedGenres) setFilterGenres(JSON.parse(savedGenres));
        if (savedArtists) setFilterArtists(JSON.parse(savedArtists));
        if (savedPopularity) setFilterPopularity(JSON.parse(savedPopularity));
    }, []);

    // Save filter preferences to local storage
    useEffect(() => {
        localStorage.setItem('filterGenres', JSON.stringify(filterGenres));
        localStorage.setItem('filterArtists', JSON.stringify(filterArtists));
        localStorage.setItem('filterPopularity', JSON.stringify(filterPopularity));
    }, [filterGenres, filterArtists, filterPopularity]);

    const generateRecommendations = useCallback((allSongs) => {
        if (!allSongs || allSongs.length === 0) {
            setRecommendations([]);
            return;
        }
        const combinedSongs = [...new Set([...allSongs, ...songs, ...filteredSongs].map(s => JSON.stringify(s)))].map(s => JSON.parse(s));

        const allGenres = [...new Set(combinedSongs.map(song => song.genre || 'Music'))];
        const allArtists = [...new Set(combinedSongs.map(song => song.artist))];

        const createFeatureVector = (song) => {
            const genreVector = allGenres.map(genre => song.genre === genre ? 1 : 0);
            const artistVector = allArtists.map(artist => song.artist === artist ? 1 : 0);
            const maxPlays = Math.max(...combinedSongs.map(s => s.plays || 0), 1);
            const plays = (song.plays || 0) / maxPlays;
            const playFrequency = recentlyPlayed.filter(s => s.id === song.id).length / (recentlyPlayed.length || 1);
            const recency = recentlyPlayed.findIndex(s => s.id === song.id) >= 0
                ? 1 - (recentlyPlayed.findIndex(s => s.id === song.id) / recentlyPlayed.length)
                : 0;
            const recencyWeight = recentlyPlayed.findIndex(s => s.id === song.id) >= 0 ? 1.5 : 1;
            return [...genreVector, ...artistVector, plays, playFrequency, recency * recencyWeight];
        };

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
        };

        const songVectors = combinedSongs.map(song => ({
            song,
            vector: createFeatureVector(song)
        }));

        const userPreferenceSongs = [
            ...recentlyPlayed,
            ...Array.from(likedSongs).map(songId => combinedSongs.find(s => s.id === songId)).filter(s => s)
        ].filter((song, index, self) => song && self.findIndex(s => s.id === song.id) === index);

        if (userPreferenceSongs.length === 0) {
            const shuffled = [...combinedSongs].sort(() => 0.5 - Math.random());
            setRecommendations(shuffled.slice(0, 6));
            return;
        }

        const userVectors = userPreferenceSongs.map(song => createFeatureVector(song));
        const userVector = userVectors.reduce(
            (avg, vec) => avg.map((val, i) => val + vec[i] / userVectors.length),
            new Array(allGenres.length + allArtists.length + 3).fill(0)
        );

        const scores = songVectors.map(({ song, vector }) => ({
            song,
            score: cosineSimilarity(userVector, vector)
        }));

        const recommendedSongs = scores
            .sort((a, b) => b.score - a.score)
            .map(item => item.song)
            .filter(song => !userPreferenceSongs.some(s => s.id === song.id))
            .slice(0, 6);

        setRecommendations(recommendedSongs);
    }, [recentlyPlayed, likedSongs, songs, filteredSongs]);

    const startVoiceSearch = () => {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError('Voice search is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        // Check if already listening
        if (isListening && recognitionRef.current) {
            return;
        }

        try {
            // Create new recognition instance
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            // Configure recognition
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log('Voice recognition started');
                setIsListening(true);
                setError(null);
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('Voice recognition result:', transcript);
                setSearchQuery(transcript);
                searchSongs(transcript);
            };

            recognition.onerror = (event) => {
                console.error('Voice recognition error:', event.error);
                setIsListening(false);

                // Provide specific error messages
                switch (event.error) {
                    case 'not-allowed':
                        setError('Microphone access denied. Please enable microphone permissions.');
                        break;
                    case 'no-speech':
                        setError('No speech detected. Please try again.');
                        break;
                    case 'network':
                        setError('Network error. Voice search requires internet connection.');
                        break;
                    case 'aborted':
                        setError('Voice recognition was aborted.');
                        break;
                    case 'audio-capture':
                        setError('No microphone found. Please connect a microphone.');
                        break;
                    case 'language-not-supported':
                        setError('Language not supported by your browser.');
                        break;
                    default:
                        setError(`Voice recognition failed: ${event.error}`);
                }
            };

            recognition.onend = () => {
                console.log('Voice recognition ended');
                setIsListening(false);
                recognitionRef.current = null;
            };

            // Start recognition
            recognition.start();

        } catch (err) {
            console.error('Failed to start voice recognition:', err);
            setError('Failed to start voice search. Please try again.');
            setIsListening(false);
        }
    };


    const stopVoiceSearch = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            } catch (err) {
                console.error('Error stopping recognition:', err);
            }
        }
        setIsListening(false);
    };

    const selectSong = useCallback(async (song, songList = null) => {
        console.log('🎵 Selecting song:', song.title);

        setError(null);
        setIsPlaying(false);

        if (!song?.id) {
            setError('Invalid song selected');
            return;
        }

        if (songList && songList.length > 0) {
            const validSongs = songList.filter(s => s.id);
            setQueue(validSongs);
            const index = validSongs.findIndex(s => s.id === song.id);
            setCurrentIndex(index >= 0 ? index : 0);
        } else {
            setQueue(prev => {
                if (prev.length === 0) {
                    const validSongs = (filteredSongs.length > 0 ? filteredSongs : songs).filter(s => s.id);
                    const index = validSongs.findIndex(s => s.id === song.id);
                    setCurrentIndex(index >= 0 ? index : 0);
                    return validSongs;
                } else {
                    const index = prev.findIndex(s => s.id === song.id);
                    if (index >= 0) {
                        setCurrentIndex(index);
                    }
                    return prev;
                }
            });
        }

        setCurrentSong(song);
        setIsPlaying(true);
        setRecentlyPlayed(prev => {
            const newPlayed = [song, ...prev.filter(s => s.id !== song.id)];
            return newPlayed.slice(0, 5);
        });

        generateRecommendations([...songs, ...filteredSongs]);
    }, [filteredSongs, songs, generateRecommendations]);

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

    // Keep a ref to the latest playNext so event handlers can call it without
    // forcing player re-creation when callbacks change.
    useEffect(() => { playNextRef.current = playNext; }, [playNext]);

    const playPrevious = useCallback(() => {
        if (queue.length === 0) return;

        if (currentTime > 3) {
            if (youtubePlayer) {
                youtubePlayer.seekTo(0);
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
    }, [queue, currentIndex, currentTime, repeat, youtubePlayer, selectSong]);

    const fetchPlaylists = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            const response = await axios.get(`${BACKEND_URL}/api/playlists/${currentUser.id}`);
            const playlistsData = response.data.map(playlist => ({
                ...playlist,
                id: playlist._id
            }));
            console.log('Fetched playlists:', playlistsData);
            setPlaylists(playlistsData);
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
            setError('Failed to load playlists');
        }
    }, [currentUser, BACKEND_URL]);

    const fetchAllPlaylists = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/playlists`);
            return response.data;
        } catch (err) {
            console.error('Failed to fetch all playlists:', err);
            setError('Failed to load all playlists');
            return [];
        }
    }, [BACKEND_URL]);

    useEffect(() => {
        if (currentUser?.id) {
            fetchPlaylists();
        }
    }, [currentUser, fetchPlaylists]);

    const deletePlaylist = async (playlistId) => {
        if (!window.confirm('Are you sure you want to delete this playlist?')) return;

        try {
            await axios.delete(`${BACKEND_URL}/api/playlists/${playlistId}`);
            setPlaylists(prev => prev.filter(p => (p._id || p.id) !== playlistId));

            if ((selectedPlaylist?._id || selectedPlaylist?.id) === playlistId) {
                setSelectedPlaylist(null);
                setActiveTab('playlists');
            }
        } catch (err) {
            console.error('Failed to delete playlist:', err);
            setError('Failed to delete playlist');
        }
    };

    const removeSongFromPlaylist = async (playlistId, songId) => {
        try {
            const response = await axios.delete(
                `${BACKEND_URL}/api/playlists/${playlistId}/songs/${songId}`
            );

            setPlaylists(prev =>
                prev.map(playlist =>
                    (playlist._id || playlist.id) === playlistId ? response.data.playlist : playlist
                )
            );

            if ((selectedPlaylist?._id || selectedPlaylist?.id) === playlistId) {
                setSelectedPlaylist(response.data.playlist);
            }
        } catch (err) {
            console.error('Failed to remove song:', err);
            setError('Failed to remove song from playlist');
        }
    };

    const startEditPlaylist = (playlist) => {
        setEditingPlaylist({ ...playlist });
    };

    const saveEditPlaylist = async () => {
        if (!editingPlaylist) return;

        try {
            const response = await axios.put(
                `${BACKEND_URL}/api/playlists/${editingPlaylist._id || editingPlaylist.id}`,
                { name: editingPlaylist.name, cover: editingPlaylist.cover || DEFAULT_COVER }
            );

            setPlaylists(prev =>
                prev.map(playlist =>
                    (playlist._id || playlist.id) === (editingPlaylist._id || editingPlaylist.id)
                        ? response.data.playlist
                        : playlist
                )
            );

            if ((selectedPlaylist?._id || selectedPlaylist?.id) === (editingPlaylist._id || editingPlaylist.id)) {
                setSelectedPlaylist(response.data.playlist);
            }

            setEditingPlaylist(null);
        } catch (err) {
            console.error('Failed to update playlist:', err);
            setError('Failed to update playlist');
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = Number(e.target.value);
        setVolume(newVolume);
        // Use safe setter to avoid calling into the YouTube iframe API
        // before the internal iframe is attached/has a valid src. This
        // prevents uncaught errors from inside the widget API (eg. reading
        // 'src' of null) which can happen in some race conditions.
        safeSetVolume(newVolume);
    };

    // Safely set volume on the YouTube player when the internal iframe is ready.
    // Retries a few times if the iframe isn't available yet.
    const safeSetVolume = useCallback((vol, player = youtubePlayer, maxAttempts = 20, attempt = 0) => {
        if (!player || typeof player.setVolume !== 'function') return;

        try {
            const iframe = typeof player.getIframe === 'function'
                ? player.getIframe()
                : playerRef.current && playerRef.current.querySelector('iframe');

            if (!iframe || iframe.src == null) {
                if (attempt < maxAttempts) {
                    return setTimeout(() => safeSetVolume(vol, player, maxAttempts, attempt + 1), 100);
                }
                console.error('safeSetVolume: iframe not ready or src is null/undefined');
                return;
            }

            // iframe exists and has src - call player API
            player.setVolume(vol);
        } catch (err) {
            console.error('safeSetVolume error:', err);
            if (attempt < maxAttempts) {
                return setTimeout(() => safeSetVolume(vol, player, maxAttempts, attempt + 1), 150);
            }
        }
    }, [youtubePlayer]);
    const handleSharePlaylist = async (playlist) => {
        if (!playlist || !playlist.id) {
            console.error('Invalid playlist:', playlist);
            setError('Cannot share playlist: Invalid playlist data');
            return;
        }
        if (!currentUser?.id) {
            console.error('Invalid user:', currentUser);
            setError('Cannot share playlist: User not logged in');
            return;
        }

        setSharePlaylist(playlist);
        const baseUrl = window.location.origin;
        const playlistUrl = `${baseUrl}/shared/playlist/${playlist.id}`;
        setShareUrl(playlistUrl);
        setShowShareModal(true);

        console.log('Sharing playlist:', playlist.id, 'User ID:', currentUser.id);

        try {
            const response = await axios.post(`${BACKEND_URL}/api/playlists/${playlist.id}/share`, {
                userId: currentUser.id
            });
            const shareToken = response.data.shareToken;
            const secureUrl = `${baseUrl}/shared/playlist/${playlist.id}?token=${shareToken}`;
            setShareUrl(secureUrl);
        } catch (err) {
            console.error('Failed to generate share token:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Failed to generate share link. Please try again.');
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('Link copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Link copied to clipboard!');
        }
    };

    const shareToSocial = (platform) => {
        const text = `Check out my playlist: ${sharePlaylist?.name}`;
        const url = encodeURIComponent(shareUrl);

        let shareLink = '';

        switch (platform) {
            case 'whatsapp':
                shareLink = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
                break;
            case 'twitter':
                shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
                break;
            case 'facebook':
                shareLink = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'telegram':
                shareLink = `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`;
                break;
            case 'linkedin':
                shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
                break;
            default:
                return;
        }

        window.open(shareLink, '_blank', 'width=600,height=400');
    };

    const handleStateChange = useCallback((event) => {
        if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setDuration(event.target.getDuration());
            setIsLoadingSong(false);
            setError(null);
        } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
        } else if (event.data === window.YT.PlayerState.ENDED) {
            if (repeat === 'one') {
                event.target.seekTo(0);
                event.target.playVideo();
            } else {
                playNext();
            }
        } else if (event.data === window.YT.PlayerState.BUFFERING) {
            setIsLoadingSong(true);
            setDuration(event.target.getDuration());
        } else if (event.data === window.YT.PlayerState.UNSTARTED) {
            setIsLoadingSong(true);
        }
    }, [repeat, playNext]);

    // Keep a ref to the latest handleStateChange so the player can call the
    // newest handler without depending on its identity in the create effect.
    useEffect(() => { handleStateChangeRef.current = handleStateChange; }, [handleStateChange]);

    // Keep refs synced with state so callbacks in the YouTube player's scope
    // can access the latest values without stale closures.
    useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    useEffect(() => {
        // Create the YouTube Player only after the playerRef node exists.
        // Some race conditions cause the YouTube widget to access an iframe
        // that hasn't been attached yet which results in "reading 'src' of null".
        let retryTimer = null;
        let scriptTag = null;

        const createPlayerIfReady = () => {
            if (!playerRef.current || !window.YT || !window.YT.Player) return false;
            try {
                /* eslint-disable no-new */
                const playerInstance = new window.YT.Player(playerRef.current, {
                    height: '0',
                    width: '0',
                    events: {
                        onReady: (event) => {
                            setYoutubePlayer(event.target);
                            youtubePlayerRef.current = event.target;
                            // Use safeSetVolume to avoid iframe race issues
                            try { safeSetVolume(volume, event.target); } catch (err) { console.error('Failed to set initial volume:', err); }
                        },
                        onStateChange: (event) => {
                            // Call latest handler from ref to avoid stale closures
                            if (handleStateChangeRef.current) return handleStateChangeRef.current(event);
                            return handleStateChange(event);
                        },
                        onError: (event) => {
                            console.error('YouTube Player error:', event.data);
                            try {
                                const code = event.data;
                                // These codes generally indicate the video can't be played
                                if ([2, 5, 100, 101, 150].includes(code)) {
                                    const failedId = currentSongRef.current?.id || (queueRef.current && queueRef.current[currentIndexRef.current]?.id);
                                        if (failedId) {
                                        failedIdsRef.current.add(failedId);

                                        // Remove failed song from queue to avoid reattempts
                                        setQueue(prev => {
                                            const newQ = prev.filter(s => s.id !== failedId);
                                            // Adjust currentIndex if needed
                                            setCurrentIndex(ci => {
                                                if (newQ.length === 0) return 0;
                                                // If the failed song was before or at current index, clamp
                                                return Math.min(ci, newQ.length - 1);
                                            });
                                            return newQ;
                                        });

                                        setError('This video cannot be played. Skipping to next...');
                                        setIsLoadingSong(false);

                                        // Try to play the next available song immediately
                                        setTimeout(() => {
                                            try { playNextRef.current?.(); } catch (err) { console.error('playNextRef error', err); }
                                        }, 100);
                                    }
                                }
                            } catch (err) {
                                console.error('onError handler failed:', err);
                            }

                            setIsPlaying(false);
                        }
                    }
                });
                // keep a stable ref
                youtubePlayerRef.current = playerInstance;
                return true;
            } catch (err) {
                console.error('createPlayerIfReady error:', err);
                return false;
            }
        };

        const waitForReady = (attempt = 0) => {
            if (createPlayerIfReady()) return;
            if (attempt >= 50) {
                console.error('YT.Player creation timed out after retries');
                return;
            }
            retryTimer = setTimeout(() => waitForReady(attempt + 1), 100);
        };

        if (!window.YT) {
            scriptTag = document.createElement('script');
            scriptTag.src = 'https://www.youtube.com/iframe_api';
            const firstScript = document.getElementsByTagName('script')[0];
            firstScript?.parentNode?.insertBefore(scriptTag, firstScript);
            window.onYouTubeIframeAPIReady = () => {
                waitForReady(0);
            };
        } else {
            waitForReady(0);
        }

        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            if (scriptTag && scriptTag.parentNode) scriptTag.parentNode.removeChild(scriptTag);
            const p = youtubePlayerRef.current;
            if (p && typeof p.destroy === 'function') {
                try { p.destroy(); } catch (err) { console.error('Error destroying player:', err); }
            }
        };
    }, [handleStateChange, playNext]);

    useEffect(() => {
        let interval;
        const p = youtubePlayerRef.current;
        if (isPlaying && p) {
            interval = setInterval(() => {
                try { setCurrentTime(p.getCurrentTime()); } catch (err) { console.error('getCurrentTime error', err); }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    useEffect(() => {
        const p = youtubePlayerRef.current;
        if (p) safeSetVolume(volume, p);
    }, [volume, safeSetVolume]);

    useEffect(() => {
        const p = youtubePlayerRef.current;
        if (p && currentSong?.id) {
            setIsLoadingSong(true);        
            const tryLoad = (attempt = 0) => {
                try {
                    const iframe = p && typeof p.getIframe === 'function'
                        ? p.getIframe()
                        : playerRef.current && playerRef.current.querySelector('iframe');

                    if (!iframe) {
                        if (attempt < 20) return setTimeout(() => tryLoad(attempt + 1), 100);
                        console.error('safeLoadVideoById: iframe not ready');
                        setIsLoadingSong(false);
                        return;
                    }

                    if (iframe.src == null) {
                        if (attempt < 20) return setTimeout(() => tryLoad(attempt + 1), 100);
                        console.error('safeLoadVideoById: iframe.src is null/undefined');
                        setIsLoadingSong(false);
                        return;
                    }

                    p.loadVideoById(currentSong.id);
                } catch (err) {
                    console.error('tryLoad error:', err);
                    if (attempt < 20) return setTimeout(() => tryLoad(attempt + 1), 150);
                    setIsLoadingSong(false);
                }
            };

            tryLoad(0);
        }
    }, [currentSong]);

    const playSong = useCallback(async (song) => {
        const p = youtubePlayerRef.current;
        if (!p || !song) return;

        setIsLoadingSong(true);
        setCurrentSong(song);
        setError(null);
        // Retry a few times to ensure the internal iframe is attached
        const tryPlay = (attempt = 0) => {
            try {
                const iframe = p && typeof p.getIframe === 'function'
                    ? p.getIframe()
                    : playerRef.current && playerRef.current.querySelector('iframe');

                if (!iframe) {
                    if (attempt < 20) return setTimeout(() => tryPlay(attempt + 1), 100);
                    throw new Error('iframe not available');
                }

                if (iframe.src == null) {
                    if (attempt < 20) return setTimeout(() => tryPlay(attempt + 1), 100);
                    throw new Error('iframe.src is null');
                }

                // Safe to call player API
                try {
                    p.loadVideoById(song.id);
                    if (typeof p.setVolume === 'function') {
                        try { safeSetVolume(volume, p); } catch (err) { console.error('setVolume failed', err); }
                    }
                    if (typeof p.playVideo === 'function') {
                        p.playVideo();
                    }
                } catch (innerErr) {
                    console.error('player API error:', innerErr);
                    if (attempt < 20) return setTimeout(() => tryPlay(attempt + 1), 150);
                    throw innerErr;
                }
            } catch (err) {
                console.error('Failed to play song:', err);
                setError('Failed to play song');
                setIsLoadingSong(false);
            }
        };

        tryPlay(0);
    }, [volume]);

    const fetchPopularSongs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    maxResults: 5,
                    order: 'viewCount',
                    type: 'video',
                    videoCategoryId: '10',
                    key: API_KEY
                }
            });

            const videoIds = response.data.items.map(item => item.id.videoId).join(',');

            const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'contentDetails,snippet,statistics',
                    id: videoIds,
                    key: API_KEY
                }
            });

            const mappedSongs = detailsResponse.data.items.map(video => {
                const durationSeconds = parseDuration(video.contentDetails.duration);
                const randomGenre = AVAILABLE_GENRES[Math.floor(Math.random() * AVAILABLE_GENRES.length)];
                return {
                    id: video.id,
                    title: video.snippet.title || 'Unknown Title',
                    artist: video.snippet.channelTitle || 'Unknown Artist',
                    album: 'YouTube',
                    duration: formatDuration(durationSeconds),
                    cover: video.snippet.thumbnails?.medium?.url || DEFAULT_COVER,
                    genre: randomGenre,
                    plays: parseInt(video.statistics?.viewCount || 0)
                };
            });

            setSongs(mappedSongs);
            setFilteredSongs(mappedSongs);
            setSearchCache(prev => ({
                ...prev,
                [cacheKey]: {
                    data: mappedSongs,
                    timestamp: Date.now()
                }
            }));

            generateRecommendations([...mappedSongs, ...filteredSongs]);

            const uniqueArtists = [...new Set(mappedSongs.map(song => song.artist))];
            setAllArtists(prev => [...new Set([...prev, ...uniqueArtists])]);
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: mappedSongs.filter(s => s.artist === name).length,
                albums: new Set(mappedSongs.filter(s => s.artist === name).map(s => s.album)).size
            })));

        } catch (err) {
            console.error('Failed to fetch popular songs:', err);
            setError('Failed to fetch popular music from YouTube');
        } finally {
            setLoading(false);
        }
    }, [generateRecommendations, filteredSongs]);

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

    useEffect(() => {
        const storedUser = window.localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            setIsAdmin(user.role === 'admin');
            //fetchPopularSongs();
        }
    }, []);

    useEffect(() => {
        if (songs.length > 0 || filteredSongs.length > 0) {
            generateRecommendations([...songs, ...filteredSongs]);
        }
    }, [songs, filteredSongs, generateRecommendations]);

    useEffect(() => {
        if (activeTab === 'admin' && isAdmin && users.length === 0) {
            fetchUsers();
        }
    }, [activeTab, isAdmin, users.length, fetchUsers]);

    const searchSongs = (query) => {
        const cacheKey = query.toLowerCase();
        const cached = searchCache[cacheKey];

        // Check cache first
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            setFilteredSongs(cached.data);
            setLoading(false);
            return;
        }

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (!query) {
            setFilteredSongs(songs);
            generateRecommendations(songs);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null); // Clear previous errors

                const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        q: query,
                        maxResults: 10,
                        type: 'video',
                        videoCategoryId: '10',
                        key: API_KEY
                    }
                });

                if (!response.data.items || response.data.items.length === 0) {
                    setFilteredSongs([]);
                    setError('No results found');
                    setLoading(false);
                    return;
                }

                const videoIds = response.data.items.map(item => item.id.videoId).join(',');

                const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                    params: {
                        part: 'contentDetails,snippet,statistics',
                        id: videoIds,
                        key: API_KEY
                    }
                });

                const mappedSongs = detailsResponse.data.items.map(video => {
                    const durationSeconds = parseDuration(video.contentDetails.duration);
                    const randomGenre = AVAILABLE_GENRES[Math.floor(Math.random() * AVAILABLE_GENRES.length)];
                    return {
                        id: video.id,
                        title: video.snippet.title || 'Unknown Title',
                        artist: video.snippet.channelTitle || 'Unknown Artist',
                        album: 'YouTube',
                        duration: formatDuration(durationSeconds),
                        cover: video.snippet.thumbnails?.medium?.url || DEFAULT_COVER,
                        genre: randomGenre,
                        plays: parseInt(video.statistics?.viewCount || 0)
                    };
                });

                setFilteredSongs(mappedSongs);

                // ✅ SAVE TO CACHE
                setSearchCache(prev => ({
                    ...prev,
                    [cacheKey]: {
                        data: mappedSongs,
                        timestamp: Date.now()
                    }
                }));

                generateRecommendations([...songs, ...mappedSongs]);

                const uniqueArtists = [...new Set(mappedSongs.map(song => song.artist))];
                setAllArtists(prev => [...new Set([...prev, ...uniqueArtists])]);

            } catch (err) {
                console.error('Search failed:', err);

                // Better error handling
                if (err.response?.status === 403) {
                    setError('YouTube quota exceeded. Please try again later.');
                } else if (err.response?.status === 400) {
                    setError('Invalid search query. Please try different keywords.');
                } else {
                    setError('Search failed. Please check your connection.');
                }
            } finally {
                setLoading(false);
            }
        }, 500);
    };


    const handleLogout = () => {
        setCurrentUser(null);
        setIsAdmin(false);
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
        setYoutubePlayer(null);
        window.localStorage.removeItem('user');
        router.push('/login');
    };

    const togglePlay = () => {
        const p = youtubePlayerRef.current;
        if (!p || !currentSong) return;

        try {
            if (isPlaying) {
                if (typeof p.pauseVideo === 'function') p.pauseVideo();
            } else {
                if (typeof p.playVideo === 'function') p.playVideo();
            }
        } catch (err) {
            console.error('Failed to toggle play/pause:', err);
        }
    };

    const handleSeek = (e) => {
        const p = youtubePlayerRef.current;
        if (!p) return;

        const seekTime = Number(e.target.value);
        setCurrentTime(seekTime);

        try {
            if (typeof p.seekTo === 'function') p.seekTo(seekTime, true);
        } catch (err) {
            console.error('Failed to seek:', err);
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

    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const createPlaylist = async () => {
        if (!newPlaylistName.trim() || !currentUser?.id) return;

        try {
            const response = await axios.post(`${BACKEND_URL}/api/playlists`, {
                name: newPlaylistName,
                userId: currentUser.id,
                cover: DEFAULT_COVER
            });

            setPlaylists(prev => [...prev, response.data.playlist]);
            setNewPlaylistName('');
            setShowCreatePlaylist(false);
        } catch (err) {
            console.error('Failed to create playlist:', err);
            setError('Failed to create playlist');
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        searchSongs(query);
    };

    const applyFilters = useCallback(() => {
        let filtered = [...songs];

        if (filterGenres.length > 0) {
            filtered = filtered.filter(song => filterGenres.includes(song.genre));
        }
        if (filterArtists.length > 0) {
            filtered = filtered.filter(song => filterArtists.includes(song.artist));
        }
        if (searchQuery) {
            filtered = filtered.filter(song =>
                (song.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (song.artist?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (song.album?.toLowerCase() || '').includes(searchQuery.toLowerCase())
            );
        }
        filtered = filtered.filter(song =>
            song.plays >= filterPopularity[0] && song.plays <= filterPopularity[1]
        );

        setFilteredSongs(filtered);
    }, [songs, filterGenres, filterArtists, searchQuery, filterPopularity]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const toggleGenreFilter = (genre) => {
        setFilterGenres(prev =>
            prev.includes(genre)
                ? prev.filter(g => g !== genre)
                : [...prev, genre]
        );
    };

    const toggleArtistFilter = (artist) => {
        setFilterArtists(prev =>
            prev.includes(artist)
                ? prev.filter(a => a !== artist)
                : [...prev, artist]
        );
    };

    const handlePopularityChange = (e) => {
        const value = Number(e.target.value);
        setFilterPopularity([0, value]);
    };

    const addSongToPlaylist = async (playlistId) => {
        if (!selectedSongForPlaylist) return;

        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/playlists/${playlistId}/songs`,
                selectedSongForPlaylist
            );

            setPlaylists(prev =>
                prev.map(playlist =>
                    (playlist._id || playlist.id) === playlistId ? response.data.playlist : playlist
                )
            );

            setShowAddToPlaylist(false);
            setSelectedSongForPlaylist(null);
        } catch (err) {
            console.error('Failed to add song:', err);
            if (err.response?.data?.message === 'Song already in playlist') {
                alert('This song is already in the playlist');
            } else {
                setError('Failed to add song to playlist');
            }
        }
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
            setFilteredSongs(prev => prev.filter(song => song.artist !== artistName));
            setArtists(prev => prev.filter(artist => artist.name !== artistName));
            setAllArtists(prev => prev.filter(artist => artist !== artistName));
        }
    };

    const deleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            await axios.delete(`${BACKEND_URL}/api/users/${userId}`);
            setUsers(prev => prev.filter(user => user._id !== userId));
        } catch (err) {
            console.error('Failed to delete user:', err);
            setUsersError('Failed to delete user');
        }
    };

    const playAllSongs = (songList) => {
        if (songList.length === 0) return;

        const validSongs = songList.filter(s => s.id);
        if (validSongs.length === 0) {
            setError('No playable songs in this list');
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
                        <button onClick={() => router.push('/login')} className="login-btn user-btn">
                            Login as User
                        </button>
                        <button onClick={() => router.push('/login')} className="login-btn admin-btn">
                            Login as Admin
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
            <div ref={playerRef} style={{ display: 'none' }}></div>

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
                                placeholder="Search songs, artists, albums... or use voice search"
                                value={searchQuery}
                                onChange={handleSearch}
                                className="search-input"
                            />
                            <button
                                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                                className={`voice-search-btn ${isListening ? 'listening' : ''}`}
                                title={isListening ? 'Stop voice search' : 'Start voice search'}
                            >
                                <Mic className="mic-icon" />
                            </button>
                        </div>
                    </div>
                    <div className="header-right">
                        <Image
                            src={currentUser.avatar || DEFAULT_AVATAR}
                            alt={currentUser.username || currentUser.name || 'User'}
                            className="user-avatar"
                            width={100}
                            height={100}
                            priority
                        />
                        <span className="user-name">{currentUser.username || currentUser.name}</span>
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
                            {playlists.slice(0, 3).map(playlist => (
                                <div
                                    key={playlist._id || playlist.id}
                                    className="playlist-item"
                                    onClick={() => openPlaylist(playlist)}
                                >
                                    <Image
                                        src={playlist.cover || DEFAULT_COVER}
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
                                                            src={song.cover || DEFAULT_COVER}
                                                            alt={song.title || 'Song'}
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
                                                            src={song.cover || DEFAULT_COVER}
                                                            alt={song.title || 'Song'}
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
                                                                src={song.cover || DEFAULT_COVER}
                                                                alt={song.title || 'Song'}
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
                                    <label className="filter-label">Genres:</label>
                                    <div className="filter-checkboxes">
                                        {AVAILABLE_GENRES.map(genre => (
                                            <label key={genre} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={filterGenres.includes(genre)}
                                                    onChange={() => toggleGenreFilter(genre)}
                                                />
                                                {genre}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Artists:</label>
                                    <div className="filter-checkboxes">
                                        {allArtists.map(artist => (
                                            <label key={artist} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={filterArtists.includes(artist)}
                                                    onChange={() => toggleArtistFilter(artist)}
                                                />
                                                {artist}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Popularity (Plays):</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000000"
                                        step="10000"
                                        value={filterPopularity[1]}
                                        onChange={handlePopularityChange}
                                        className="filter-slider"
                                    />
                                    <span>{filterPopularity[1].toLocaleString()} plays</span>
                                </div>
                            </div>
                            {loading ? <p>Loading...</p> : error ? <p className="error-text">{error}</p> : filteredSongs.length > 0 ? (
                                <div className="search-results">
                                    {filteredSongs.map((song) => (
                                        <div key={song.id} className="search-item">
                                            <Image
                                                src={song.cover || DEFAULT_COVER}
                                                alt={song.title || 'Song'}
                                                className="search-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="search-info" onClick={() => selectSong(song)}>
                                                <h4 className="search-title">{song.title}</h4>
                                                <p className="search-artist">{song.artist} • {song.album}</p>
                                                <p className="search-genre">{song.genre} • {song.plays.toLocaleString()} plays</p>
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
                                    {playlists.map(playlist => (
                                        <div
                                            key={playlist.id || playlist._id} // Use id if available, fallback to _id
                                            className="playlist-card-wrapper"
                                        >
                                            <div
                                                className="playlist-card"
                                                onClick={() => openPlaylist(playlist)}
                                            >
                                                <Image
                                                    src={playlist.cover || DEFAULT_COVER}
                                                    alt={playlist.name}
                                                    className="playlist-card-cover"
                                                    width={300}
                                                    height={300}
                                                    loading="lazy"
                                                />
                                                <div className="playlist-card-overlay">
                                                    <button
                                                        className="playlist-play-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playAllSongs(playlist.songs);
                                                        }}
                                                    >
                                                        <Play className="play-icon" />
                                                    </button>
                                                </div>
                                                <h3 className="playlist-card-name">{playlist.name}</h3>
                                                <p className="playlist-card-count">{playlist.songs.length} songs</p>
                                            </div>
                                            <button
                                                className="share-playlist-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('Clicked share for playlist:', playlist);
                                                    handleSharePlaylist(playlist);
                                                }}
                                                title="Share playlist"
                                            >
                                                <Share2 className="share-icon" /> Share
                                            </button>
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
                                        src={selectedPlaylist.cover || DEFAULT_COVER}
                                        alt={selectedPlaylist.name || 'Playlist'}
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
                                        {isAdmin && (
                                            <div className="playlist-actions">
                                                <button
                                                    onClick={() => startEditPlaylist(selectedPlaylist)}
                                                    className="edit-btn"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deletePlaylist(selectedPlaylist._id || selectedPlaylist.id)}
                                                    className="delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {editingPlaylist && (editingPlaylist._id || editingPlaylist.id) === (selectedPlaylist._id || selectedPlaylist.id) ? (
                                <div className="edit-playlist-form">
                                    <h3 className="form-title">Edit Playlist</h3>
                                    <div className="form-controls">
                                        <input
                                            type="text"
                                            placeholder="Playlist name"
                                            value={editingPlaylist.name}
                                            onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                                            className="playlist-input"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Cover URL"
                                            value={editingPlaylist.cover || DEFAULT_COVER}
                                            onChange={(e) => setEditingPlaylist({ ...editingPlaylist, cover: e.target.value })}
                                            className="playlist-input"
                                        />
                                        <button onClick={saveEditPlaylist} className="create-btn">Save</button>
                                        <button onClick={() => setEditingPlaylist(null)} className="cancel-btn">Cancel</button>
                                    </div>
                                </div>
                            ) : null}
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
                                                src={song.cover || DEFAULT_COVER}
                                                alt={song.title || 'Song'}
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
                                            {isAdmin && (
                                                <button
                                                    className="remove-song-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeSongFromPlaylist(selectedPlaylist._id || selectedPlaylist.id, song.id);
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            )}
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
                                            <p className="stat-value">{songs.reduce((sum, song) => sum + (song.plays || 0), 0).toLocaleString()}</p>
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
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => deleteUser(user._id)}
                                                    >
                                                        Delete
                                                    </button>
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
                                                value={editingSong.title || ''}
                                                onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                                                className="form-input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Artist"
                                                value={editingSong.artist || ''}
                                                onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                                                className="form-input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Album"
                                                value={editingSong.album || ''}
                                                onChange={(e) => setEditingSong({ ...editingSong, album: e.target.value })}
                                                className="form-input"
                                            />
                                            <select
                                                value={editingSong.genre || 'Music'}
                                                onChange={(e) => setEditingSong({ ...editingSong, genre: e.target.value })}
                                                className="form-select"
                                            >
                                                {AVAILABLE_GENRES.map(genre => (
                                                    <option key={genre} value={genre}>{genre}</option>
                                                ))}
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
                                                src={song.cover || DEFAULT_COVER}
                                                alt={song.title || 'Song'}
                                                className="admin-song-cover"
                                                width={300}
                                                height={300}
                                                loading="lazy"
                                            />
                                            <div className="admin-song-info">
                                                <h4 className="admin-song-title">{song.title}</h4>
                                                <p className="admin-song-artist">{song.artist} • {song.album}</p>
                                                <p className="admin-song-genre">{song.genre} • {(song.plays || 0).toLocaleString()} plays</p>
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
                            <div className="admin-panel">
                                <h3 className="panel-title">Playlists Management</h3>
                                {editingPlaylist ? (
                                    <div className="edit-playlist-form">
                                        <h4 className="form-title">Edit Playlist</h4>
                                        <div className="form-grid">
                                            <input
                                                type="text"
                                                placeholder="Playlist Name"
                                                value={editingPlaylist.name}
                                                onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                                                className="form-input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Cover URL"
                                                value={editingPlaylist.cover || DEFAULT_COVER}
                                                onChange={(e) => setEditingPlaylist({ ...editingPlaylist, cover: e.target.value })}
                                                className="form-input"
                                            />
                                        </div>
                                        <div className="form-actions">
                                            <button onClick={saveEditPlaylist} className="save-btn">Save Changes</button>
                                            <button onClick={() => setEditingPlaylist(null)} className="cancel-btn">Cancel</button>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="playlists-grid">
                                    {playlists.map(playlist => (
                                        <div key={playlist.id || playlist._id} className="playlist-card">
                                            <div onClick={() => openPlaylist(playlist)}>
                                                <Image
                                                    src={playlist.cover || DEFAULT_COVER}
                                                    alt={playlist.name}
                                                    className="playlist-card-cover"
                                                    width={300}
                                                    height={300}
                                                    loading="lazy"
                                                />
                                                <div className="playlist-card-overlay">
                                                    <button
                                                        className="playlist-play-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playAllSongs(playlist.songs);
                                                        }}
                                                    >
                                                        <Play className="play-icon" />
                                                    </button>
                                                </div>
                                                <h3 className="playlist-card-name">{playlist.name}</h3>
                                                <p className="playlist-card-count">{playlist.songs.length} songs</p>
                                            </div>
                                            <button
                                                className="share-playlist-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('Clicked share for playlist (admin):', playlist);
                                                    handleSharePlaylist(playlist);
                                                }}
                                                title="Share playlist"
                                            >
                                                <Share2 className="share-icon" /> Share
                                            </button>
                                            <div className="playlist-actions">
                                                <button
                                                    onClick={() => startEditPlaylist(playlist)}
                                                    className="edit-btn"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deletePlaylist(playlist.id || playlist._id)}
                                                    className="delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </div>
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
                        <p className="modal-subtitle">Select a playlist for {selectedSongForPlaylist?.title || 'Song'}</p>
                        <div className="modal-playlist-list">
                            {playlists.map(playlist => (
                                <button
                                    key={playlist._id || playlist.id}
                                    onClick={() => addSongToPlaylist(playlist._id || playlist.id)}
                                    className="modal-playlist-item"
                                >
                                    <Image
                                        src={playlist.cover || DEFAULT_COVER}
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
                                src={currentSong.cover || DEFAULT_COVER}
                                alt={currentSong.title || 'Song'}
                                className="player-cover"
                                width={300}
                                height={300}
                                loading="lazy"
                            />
                            <div className="player-info">
                                <h4 className="player-title">{currentSong.title}</h4>
                                <p className="player-artist">{currentSong.artist}</p>
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
                                    onChange={handleVolumeChange}
                                    className="volume-slider"
                                    aria-label="Volume control"
                                />
                                <span className="volume-value">{volume}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="progress-section">
                        {error && <p className="player-error">{error}</p>}
                        {isLoadingSong && <p className="player-loading">Loading...</p>}
                        <div className="progress-time">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="progress-bar"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )}
            {showShareModal && sharePlaylist && (
                <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
                    <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Share Playlist</h3>
                        <p className="modal-subtitle">{sharePlaylist.name}</p>

                        {/* Copy Link Section */}
                        <div className="share-link-section">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="share-link-input"
                            />
                            <button
                                onClick={() => copyToClipboard(shareUrl)}
                                className="copy-link-btn"
                            >
                                Copy Link
                            </button>
                        </div>

                        {/* Social Share Buttons */}
                        <div className="social-share-section">
                            <h4 className="share-section-title">Share on social media</h4>
                            <div className="social-share-buttons">
                                <button
                                    onClick={() => shareToSocial('whatsapp')}
                                    className="social-btn whatsapp"
                                    title="Share on WhatsApp"
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24">
                                        <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                    WhatsApp
                                </button>

                                <button
                                    onClick={() => shareToSocial('twitter')}
                                    className="social-btn twitter"
                                    title="Share on Twitter"
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24">
                                        <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                    Twitter
                                </button>

                                <button
                                    onClick={() => shareToSocial('facebook')}
                                    className="social-btn facebook"
                                    title="Share on Facebook"
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24">
                                        <path fill="currentColor" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                    Facebook
                                </button>

                                <button
                                    onClick={() => shareToSocial('telegram')}
                                    className="social-btn telegram"
                                    title="Share on Telegram"
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24">
                                        <path fill="currentColor" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                    Telegram
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowShareModal(false)}
                            className="modal-close-btn"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}