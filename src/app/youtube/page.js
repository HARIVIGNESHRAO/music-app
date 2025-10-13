'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, Users, BarChart3, Shield, Mic
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
    const searchTimerRef = useRef(null);
    const recognitionRef = useRef(null);
    const [searchCache, setSearchCache] = useState({});
    const CACHE_DURATION = 3600000; // 1 hour
    const API_KEY = 'AIzaSyB6C6QO9Yd4IpW3ecaSg7BBY7JalpjDQ6s';
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net';
    const DEFAULT_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center';
    const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center';

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
        if (!('webkitSpeechRecognition' in window)) {
            setError('Voice search is not supported in this browser');
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
            searchSongs(transcript);
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            setError('Voice recognition failed. Please try again.');
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const stopVoiceSearch = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
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
            setPlaylists(response.data);
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

        if (youtubePlayer && typeof youtubePlayer.setVolume === 'function') {
            try {
                youtubePlayer.setVolume(newVolume);
            } catch (err) {
                console.error('Failed to set volume:', err);
            }
        }
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

    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScript = document.getElementsByTagName('script')[0];
            firstScript.parentNode.insertBefore(tag, firstScript);

            window.onYouTubeIframeAPIReady = () => {
                const player = new window.YT.Player(playerRef.current, {
                    height: '0',
                    width: '0',
                    events: {
                        onReady: (event) => {
                            setYoutubePlayer(event.target);
                            try {
                                event.target.setVolume(volume);
                            } catch (err) {
                                console.error('Failed to set initial volume:', err);
                            }
                        },
                        onStateChange: handleStateChange,
                        onError: (event) => {
                            console.error('YouTube Player error:', event.data);
                            if ([2, 5, 100, 101, 150].includes(event.data)) {
                                setError('This video cannot be played. Trying next...');
                                setTimeout(() => {
                                    playNext();
                                }, 2000);
                            }
                            setIsPlaying(false);
                        }
                    }
                });
            };
        } else if (window.YT && window.YT.Player) {
            const player = new window.YT.Player(playerRef.current, {
                height: '0',
                width: '0',
                events: {
                    onReady: (event) => {
                        setYoutubePlayer(event.target);
                        try {
                            event.target.setVolume(volume);
                        } catch (err) {
                            console.error('Failed to set initial volume:', err);
                        }
                    },
                    onStateChange: handleStateChange,
                    onError: (event) => {
                        console.error('YouTube Player error:', event.data);
                        if ([2, 5, 100, 101, 150].includes(event.data)) {
                            setError('This video cannot be played. Trying next...');
                            setTimeout(() => {
                                playNext();
                            }, 2000);
                        }
                        setIsPlaying(false);
                    }
                }
            });
        }

        return () => {
            if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
                try {
                    youtubePlayer.destroy();
                } catch (err) {
                    console.error('Error destroying player:', err);
                }
            }
        };
    }, [handleStateChange]);

    useEffect(() => {
        let interval;
        if (isPlaying && youtubePlayer) {
            interval = setInterval(() => {
                setCurrentTime(youtubePlayer.getCurrentTime());
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, youtubePlayer]);

    useEffect(() => {
        if (youtubePlayer) {
            youtubePlayer.setVolume(volume);
        }
    }, [volume, youtubePlayer]);

    useEffect(() => {
        if (youtubePlayer && currentSong?.id) {
            setIsLoadingSong(true);
            youtubePlayer.loadVideoById(currentSong.id);
        }
    }, [currentSong, youtubePlayer]);

    const playSong = useCallback(async (song) => {
        if (!youtubePlayer || !song) return;

        setIsLoadingSong(true);
        setCurrentSong(song);
        setError(null);

        try {
            await youtubePlayer.loadVideoById(song.id);
            if (typeof youtubePlayer.setVolume === 'function') {
                youtubePlayer.setVolume(volume);
            }
            youtubePlayer.playVideo();
        } catch (err) {
            console.error('Failed to play song:', err);
            setError('Failed to play song');
            setIsLoadingSong(false);
        }
    }, [youtubePlayer, volume]);

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
        if (!youtubePlayer || !currentSong) return;

        try {
            if (isPlaying) {
                if (typeof youtubePlayer.pauseVideo === 'function') {
                    youtubePlayer.pauseVideo();
                }
            } else {
                if (typeof youtubePlayer.playVideo === 'function') {
                    youtubePlayer.playVideo();
                }
            }
        } catch (err) {
            console.error('Failed to toggle play/pause:', err);
        }
    };

    const handleSeek = (e) => {
        if (!youtubePlayer) return;

        const seekTime = Number(e.target.value);
        setCurrentTime(seekTime);

        try {
            if (typeof youtubePlayer.seekTo === 'function') {
                youtubePlayer.seekTo(seekTime, true);
            }
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
                                            key={playlist._id || playlist.id}
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
                                        <div key={playlist._id || playlist.id} className="playlist-card">
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
                                            <div className="playlist-actions">
                                                <button
                                                    onClick={() => startEditPlaylist(playlist)}
                                                    className="edit-btn"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deletePlaylist(playlist._id || playlist.id)}
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
        </div>
    );
}