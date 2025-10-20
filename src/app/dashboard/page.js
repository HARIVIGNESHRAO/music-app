'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import './page.css';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, Heart, Search, Home, Music, User,
    Plus, Shuffle, Repeat, MoreVertical, TrendingUp, BarChart3, Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Static songs data removed per request; keeping empty array to avoid breaking references
const staticSongs = [];

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
    const [songs, setSongs] = useState([]);
    const [filteredSongs, setFilteredSongs] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [filterGenre, setFilterGenre] = useState('all');
    const [filterArtist, setFilterArtist] = useState('all');
    const [filterAlbum, setFilterAlbum] = useState('all');
    const [filterPopularityMin, setFilterPopularityMin] = useState(0);
    const [filterDuration, setFilterDuration] = useState('any'); // options: any, short, medium, long
    const [filterExplicit, setFilterExplicit] = useState('all'); // all, explicit, clean
    const [filterYear, setFilterYear] = useState('all');
    const [albums, setAlbums] = useState([]);
    const [years, setYears] = useState([]);
    const [genres, setGenres] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
    const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
    const [artists, setArtists] = useState([]);
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
    const volumeTimeoutRef = useRef(null);
    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
    const RESPONSE_TYPE = 'code';
    const SCOPES = 'user-read-private user-read-email user-top-read playlist-read-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state';
    const CODE_CHALLENGE_METHOD = 'S256';

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

    const generateRecommendations = useCallback((allSongs) => {
        if (!allSongs || allSongs.length === 0) {
            setRecommendations([]);
            return;
        }

        // Build feature space
        const allGenres = [...new Set(allSongs.map(song => song.genre).filter(Boolean))];
        const allArtists = [...new Set(allSongs.map(song => song.artist).filter(Boolean))];

        const toSeconds = (d) => {
            if (!d) return 0;
            const parts = d.split(':').map(Number);
            return parts[0] * 60 + (parts[1] || 0);
        };

        const maxPlays = Math.max(...allSongs.map(s => s.plays || 0), 1);
        const maxPopularity = Math.max(...allSongs.map(s => s.popularity || 0), 1);
        const maxDuration = Math.max(...allSongs.map(s => toSeconds(s.duration) || 0), 1);

        const createFeatureVector = (song) => {
            const genreVector = allGenres.map(g => song.genre === g ? 1 : 0);
            const artistVector = allArtists.map(a => song.artist === a ? 1 : 0);
            const popularity = (song.popularity || 0) / maxPopularity;
            const duration = (toSeconds(song.duration) || 0) / Math.max(240, maxDuration); // normalize
            return [...genreVector, ...artistVector, popularity, duration];
        };

        const dot = (A, B) => A.reduce((s, a, i) => s + a * (B[i] || 0), 0);
        const magnitude = (A) => Math.sqrt(A.reduce((s, a) => s + a * a, 0));
        const cosine = (A, B) => {
            const magA = magnitude(A); const magB = magnitude(B);
            return (magA && magB) ? dot(A, B) / (magA * magB) : 0;
        };

        // Build song vectors
        const songVectors = allSongs.map(s => ({ song: s, vec: createFeatureVector(s) }));

        // Build weighted user preference vector: recentlyPlayed weighted by recency + liked songs
        const recentWeights = recentlyPlayed.map((s, idx) => 1 / (idx + 1)); // more recent higher weight
        const likedArray = Array.from(likedSongs).map(id => allSongs.find(s => s.id === id)).filter(Boolean);

        const preferencePool = [];
        recentlyPlayed.forEach((s, idx) => { if (s) preferencePool.push({ song: s, weight: 1 / (idx + 1) }); });
        likedArray.forEach((s) => preferencePool.push({ song: s, weight: 0.9 }));

        if (preferencePool.length === 0) {
            // no user context — return a small curated set by popularity, but add some randomness
            const fallback = [...allSongs]
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                .slice(0, 50)
                .sort(() => 0.7 - Math.random())
                .slice(0, 6);
            setRecommendations(fallback);
            return;
        }

        // aggregate weighted vector
        const prefVectors = preferencePool.map(p => createFeatureVector(p.song).map(v => v * p.weight));
        const sumVector = prefVectors.reduce((acc, vec) => acc.map((val, i) => val + (vec[i] || 0)), new Array(prefVectors[0].length).fill(0));
        const totalWeight = preferencePool.reduce((s, p) => s + p.weight, 0) || 1;
        const userVector = sumVector.map(v => v / totalWeight);

        // build set of excluded ids (recently played + queue neighbors)
        const excludedIds = new Set(recentlyPlayed.map(s => s.id).filter(Boolean));
        (queue || []).forEach(s => s && s.id && excludedIds.add(s.id));
        // exclude immediate neighbors to avoid recommending the next track from the same playlist
        if (typeof currentIndex === 'number' && queue && queue.length > 0) {
            [currentIndex - 1, currentIndex + 1].forEach(i => {
                const t = queue[i]; if (t && t.id) excludedIds.add(t.id);
            });
        }

        // Score each candidate
        const candidates = songVectors.map(({ song, vec }) => {
            const sim = cosine(userVector, vec);
            const pop = (song.popularity || 0) / 100; // 0..1
            // exploration factor
            const explore = Math.random() * 0.08;
            let score = 0.7 * sim + 0.25 * pop + explore;
            // Penalize songs recently played
            if (recentlyPlayed.some(r => r.id === song.id)) score *= 0.4;
            return { song, score, sim, pop };
        })
            .filter(c => c.song && !excludedIds.has(c.song.id));

        // Sort and select while enforcing diversity (artist + genre)
        candidates.sort((a, b) => b.score - a.score);

        const selected = [];
        const seenArtists = new Set();
        const seenGenres = new Set();
        for (const c of candidates) {
            if (selected.length >= 8) break;
            const artist = c.song.artist;
            const genre = c.song.genre;
            // allow same artist only once (but allow up to 2 if not many options)
            if (seenArtists.has(artist) && selected.length >= 4) continue;
            // avoid exact same genre too many times
            const genreCount = [...selected].filter(s => s.genre === genre).length;
            if (genreCount >= 3) continue;
            selected.push(c.song);
            seenArtists.add(artist);
            seenGenres.add(genre);
        }

        // If not enough selected, fill from top candidates ignoring diversity
        if (selected.length < 6) {
            for (const c of candidates) {
                if (selected.find(s => s.id === c.song.id)) continue;
                selected.push(c.song);
                if (selected.length >= 6) break;
            }
        }

        setRecommendations(selected.slice(0, 8));
    }, [recentlyPlayed, likedSongs, queue, currentIndex]);

    const fetchTopTracks = useCallback(async (token) => {
        try {
            setLoading(true);
            setError(null);

            const cachedTracks = getCachedData(CACHE_KEY_TOP_TRACKS);
            if (cachedTracks) {
                setSongs(cachedTracks);
                return cachedTracks;
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            const response = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=10&fields=items(id,name,artists(id,name),album(name,images),duration_ms,preview_url,uri,popularity)',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            // Fetch genres for the artists referenced by these tracks
            const artistIds = Array.from(new Set(response.data.items.flatMap(t => (t.artists || []).map(a => a.id)).filter(Boolean)));
            let artistMap = {};
            if (artistIds.length > 0) {
                try {
                    const artistsResp = await apiCallWithBackoff(() =>
                        axios.get(`https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                    );
                    (artistsResp.data.artists || []).forEach(a => {
                        artistMap[a.id] = (a.genres || []);
                    });
                } catch (err) {
                    console.warn('Failed to fetch artist genres:', err);
                }
            }

            const mappedSongs = response.data.items.map(track => {
                const primaryArtistId = track.artists?.[0]?.id;
                const artistGenres = primaryArtistId ? (artistMap[primaryArtistId] || []) : [];
                const genre = artistGenres.length > 0 ? artistGenres[0] : 'Unknown';
                return {
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                    cover: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
                    genre,
                    plays: track.popularity * 10000,
                    popularity: track.popularity || 0,
                    preview_url: track.preview_url || null,
                    spotify_uri: track.uri,
                    explicit: !!track.explicit,
                    release_date: track.album?.release_date || null,
                };
            });

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
                return cachedPlaylists;
            }

            const playlistsResponse = await apiCallWithBackoff(() =>
                axios.get(
                    'https://api.spotify.com/v1/me/playlists?limit=10&fields=items(id,name,tracks.href,images)',
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                )
            );

            const playlistsWithSongs = [];
            const MAX_PLAYLISTS = 10;
            for (const playlist of playlistsResponse.data.items.slice(0, MAX_PLAYLISTS)) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    const tracksResponse = await apiCallWithBackoff(() =>
                        axios.get(
                            `${playlist.tracks.href}?fields=items(track(id,name,artists(id,name),album(name,images),duration_ms,preview_url,uri,popularity,explicit))`,
                            {
                                headers: { Authorization: `Bearer ${token}` },
                            }
                        )
                    );

                    // gather artist ids for genre lookup
                    const playlistArtistIds = Array.from(new Set(tracksResponse.data.items.flatMap(i => (i.track?.artists || []).map(a => a.id)).filter(Boolean)));
                    let playlistArtistMap = {};
                    if (playlistArtistIds.length > 0) {
                        try {
                            const artistsResp = await apiCallWithBackoff(() =>
                                axios.get(`https://api.spotify.com/v1/artists?ids=${playlistArtistIds.join(',')}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                })
                            );
                            (artistsResp.data.artists || []).forEach(a => {
                                playlistArtistMap[a.id] = (a.genres || []);
                            });
                        } catch (err) {
                            console.warn('Failed to fetch playlist artist genres:', err);
                        }
                    }

                    const playlistSongs = tracksResponse.data.items
                        .filter(item => item.track && item.track.id)
                        .map(item => {
                            const t = item.track;
                            const primaryArtistId = t.artists?.[0]?.id;
                            const artistGenres = primaryArtistId ? (playlistArtistMap[primaryArtistId] || []) : [];
                            const genre = artistGenres.length > 0 ? artistGenres[0] : 'Unknown';
                            return {
                                id: t.id,
                                title: t.name,
                                artist: t.artists.map(a => a.name).join(', '),
                                album: t.album.name,
                                duration: new Date(t.duration_ms).toISOString().substr(14, 5),
                                cover: t.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
                                genre,
                                plays: 0,
                                popularity: t.popularity || 0,
                                preview_url: t.preview_url || null,
                                spotify_uri: t.uri,
                                explicit: !!t.explicit,
                                release_date: t.album?.release_date || null,
                            };
                        });
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
            return playlistsWithSongs;
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
            setError(err.response?.status === 429 ? 'Rate limit exceeded. Please wait and try again.' : 'Failed to fetch playlists');
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
                        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&fields=tracks(items(id,name,artists(id,name,uri),album(name,images),duration_ms,preview_url,uri,popularity))`,
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        }
                    )
                );
                // Ensure we requested artist ids in the search fields
                const trackArtistIds = Array.from(new Set(response.data.tracks.items.flatMap(t => (t.artists || []).map(a => a.id)).filter(Boolean)));
                let searchArtistMap = {};
                if (trackArtistIds.length > 0) {
                    try {
                        const artistsResp = await apiCallWithBackoff(() =>
                            axios.get(`https://api.spotify.com/v1/artists?ids=${trackArtistIds.join(',')}`, {
                                headers: { Authorization: `Bearer ${accessToken}` }
                            })
                        );
                        (artistsResp.data.artists || []).forEach(a => {
                            searchArtistMap[a.id] = (a.genres || []);
                        });
                    } catch (err) {
                        console.warn('Failed to fetch artist genres for search results:', err);
                    }
                }

                const mappedSongs = response.data.tracks.items.map(track => {
                    const primaryArtistId = track.artists?.[0]?.id;
                    const artistGenres = primaryArtistId ? (searchArtistMap[primaryArtistId] || []) : [];
                    const genre = artistGenres.length > 0 ? artistGenres[0] : 'Unknown';
                    return {
                        id: track.id,
                        title: track.name,
                        artist: track.artists.map(a => a.name).join(', '),
                        album: track.album.name,
                        duration: new Date(track.duration_ms).toISOString().substr(14, 5),
                        cover: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
                        genre,
                        plays: track.popularity * 10000,
                        popularity: track.popularity || 0,
                        preview_url: track.preview_url || null,
                        spotify_uri: track.uri,
                        explicit: !!track.explicit,
                        release_date: track.album?.release_date || null,
                    };
                });
                // Set songs so derived lists (artists, albums, years) update, then apply filters
                setSongs(mappedSongs);
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
        // Mark UI as loading immediately to prevent other effects from auto-playing
        setIsLoadingSong(true);

        console.log("Selecting song:", song.title, "hasPreview:", !!song.preview_url, "hasUri:", !!song.spotify_uri);

        if (!isSongPlayable(song)) {
            setError(`No playable content available for ${song.title}`);
            setCurrentSong(song);
            setIsPlaying(false);
            setIsLoadingSong(false);
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
        setError(null);

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
            console.log('Fetching user profile...');

            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = {
                id: data.id,
                name: data.display_name,
                email: data.email,
                avatar: data.images?.[0]?.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=center',
                product: data.product || 'free'
            };

            setCurrentUser(user);
            setIsPremium(user.product === 'premium');
            window.localStorage.setItem('user', JSON.stringify(user));

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
            const topTracks = await fetchTopTracks(accessToken);

            console.log('📥 Loading playlists...');
            const userPlaylists = await fetchUserPlaylists(accessToken);

            const allKnownSongs = [...topTracks, ...userPlaylists.flatMap(p => p.songs)].reduce((unique, song) => {
                if (!unique.some(s => s.id === song.id)) unique.push(song);
                return unique;
            }, []);

            generateRecommendations(allKnownSongs);

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
    }, [accessToken, fetchTopTracks, fetchUserPlaylists, generateRecommendations]);

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
                        code_verifier: codeVerifier,
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                const { access_token } = response.data;
                window.localStorage.setItem('spotify_token', access_token);
                window.localStorage.removeItem('spotify_code_verifier');
                setAccessToken(access_token);

                // Remove code from URL
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

            setSongs(staticSongs);
            setFilteredSongs(staticSongs);

            const uniqueArtists = [...new Set(staticSongs.map(song => song.artist))];
            setArtists(uniqueArtists.map((name, idx) => ({
                id: idx + 1,
                name,
                songs: staticSongs.filter(s => s.artist === name).length,
                albums: new Set(staticSongs.filter(s => s.artist === name).map(s => s.album)).size
            })));

            generateRecommendations(staticSongs);
        }

        const storedToken = window.localStorage.getItem('spotify_token');
        if (storedToken && !profileLoadedRef.current) {
            setAccessToken(storedToken);
            fetchUserProfile(storedToken);
        }
    }, [fetchUserProfile, generateRecommendations]);

    // Recompute recommendations when recent plays, likes, or library change
    useEffect(() => {
        // Build a pool of known songs from loaded songs, playlists, and recent plays
        const playlistSongs = playlists.flatMap(p => p.songs || []);
        const poolMap = new Map();
        [...songs, ...playlistSongs, ...recentlyPlayed].forEach(s => {
            if (s && s.id && !poolMap.has(s.id)) {
                poolMap.set(s.id, s);
            }
        });
        const pool = Array.from(poolMap.values());
        generateRecommendations(pool);
    }, [recentlyPlayed, likedSongs, songs, playlists, generateRecommendations]);

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
                // Store player instance so controls (play/pause/seek/volume) can access it
                setSpotifyPlayer(playerInstance);

                playerInstance.addListener('ready', ({ device_id }) => {
                    console.log('Spotify Player ready with Device ID', device_id);
                    setDeviceId(device_id);
                    setPlayerReady(true);
                    // Transfer playback to this device
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
                        // Attempt to fetch artist genres for the current track's primary artist
                        (async () => {
                            let genre = 'Unknown';
                            try {
                                const artistId = track.artists?.[0]?.id;
                                if (artistId && accessToken) {
                                    const resp = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
                                    const g = resp.data.genres || [];
                                    if (g.length > 0) genre = g[0];
                                }
                            } catch (err) {
                                console.warn('Failed to fetch artist genre for SDK track:', err);
                            }

                            const newSong = {
                                id: track.id,
                                title: track.name,
                                artist: track.artists.map(a => a.name).join(', '),
                                album: track.album.name,
                                duration: new Date(track.duration).toISOString().substr(14, 5),
                                cover: track.album.images[0]?.url || 'default-cover',
                                genre,
                                plays: 0,
                                spotify_uri: track.uri
                            };
                            setCurrentSong(newSong);
                            setRecentlyPlayed(prev => {
                                const newPlayed = [newSong, ...prev.filter(s => s.id !== track.id)];
                                return newPlayed; // keep full session history for recommendations
                            });
                        })();
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
                try { playerInstance.disconnect(); } catch {}
            }
            setSpotifyPlayer(null);
            if (scriptElement && document.body.contains(scriptElement)) {
                document.body.removeChild(scriptElement);
            }
        };
    // Note: we intentionally do NOT include `volume` here. Changing volume should
    // update the existing player via spotifyPlayer.setVolume in a separate effect
    // below. Including `volume` would reinitialize the Spotify Player and disrupt
    // playback whenever the user adjusts the volume.
    }, [accessToken, isPremium]);

    useEffect(() => {
        // Clamp volume and apply safely to both HTML audio and Spotify SDK.
        const clamped = Math.max(0, Math.min(100, Number(volume) || 0));
        const volFraction = clamped / 100;

        if (audioRef.current) {
            try {
                audioRef.current.volume = volFraction;
            } catch (err) {
                console.warn('Unable to set HTMLAudioElement volume:', err);
            }
        }

        // Debounce rapid volume changes before calling the Spotify SDK
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        volumeTimeoutRef.current = setTimeout(() => {
            if (spotifyPlayer && typeof spotifyPlayer.setVolume === 'function' && playerReady) {
                spotifyPlayer.setVolume(volFraction).catch(err =>
                    console.error('Failed to set volume on Spotify player:', err)
                );
            }
        }, 120);

        return () => {
            if (volumeTimeoutRef.current) {
                clearTimeout(volumeTimeoutRef.current);
                volumeTimeoutRef.current = null;
            }
        };
    }, [volume, spotifyPlayer]);

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
                                return newPlayed; // keep full session history for recommendations
                            });
                            setIsPlaying(true);
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

                        if (!isCancelled) {
                            try {
                                await audio.play();
                                console.log("Preview playing");
                                setError(null);
                                setRecentlyPlayed((prev) => {
                                    const newPlayed = [currentSong, ...prev.filter((s) => s.id !== currentSong.id)];
                                    return newPlayed; // keep full session history for recommendations
                                });
                                setIsPlaying(true);
                            } catch (playErr) {
                                console.error('Preview play failed:', playErr);
                                setIsPlaying(false);
                            }
                        }
                    return;
                }

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
    }, [currentSong?.id, isPremium, playerReady, deviceId, accessToken]);

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
        router.push('/dashboard');
    };

    const togglePlay = async () => {
        try {
            if (isPremium && spotifyPlayer && playerReady) {
                // Use SDK toggle to handle both pause and resume reliably
                await spotifyPlayer.togglePlay();
                setIsPlaying(prev => !prev);
                return;
            }

            const audio = audioRef.current;
            if (audio) {
                if (isPlaying) {
                    await audio.pause();
                    setIsPlaying(false);
                } else {
                    await audio.play();
                    setIsPlaying(true);
                }
                return;
            }

            // Fallback: just flip the state
            setIsPlaying(prev => !prev);
        } catch (err) {
            console.error('Toggle play failed:', err);
            setError('Unable to toggle playback');
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
        if (filterAlbum !== 'all') {
            filtered = filtered.filter(song => song.album === filterAlbum);
        }
        if (filterPopularityMin && Number(filterPopularityMin) > 0) {
            filtered = filtered.filter(song => (song.popularity || 0) >= Number(filterPopularityMin));
        }
        if (filterDuration && filterDuration !== 'any') {
            // duration is stored as mm:ss — convert to seconds
            const toSeconds = (d) => {
                if (!d) return 0;
                const parts = d.split(':').map(Number);
                return parts[0] * 60 + (parts[1] || 0);
            };
            if (filterDuration === 'short') {
                filtered = filtered.filter(song => toSeconds(song.duration) < 180);
            } else if (filterDuration === 'medium') {
                filtered = filtered.filter(song => toSeconds(song.duration) >= 180 && toSeconds(song.duration) <= 300);
            } else if (filterDuration === 'long') {
                filtered = filtered.filter(song => toSeconds(song.duration) > 300);
            }
        }
        if (filterExplicit && filterExplicit !== 'all') {
            if (filterExplicit === 'explicit') filtered = filtered.filter(song => !!song.explicit);
            if (filterExplicit === 'clean') filtered = filtered.filter(song => !song.explicit);
        }
        if (filterYear && filterYear !== 'all') {
            filtered = filtered.filter(song => {
                const y = song.release_date ? (song.release_date.split('-')[0]) : null;
                return y === String(filterYear);
            });
        }
        if (searchQuery) {
            filtered = filtered.filter(song =>
                song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.album.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredSongs(filtered);
    }, [songs, filterGenre, filterArtist, filterAlbum, filterPopularityMin, filterDuration, filterExplicit, filterYear, searchQuery]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    // Derive albums and years from the loaded songs for richer filters
    useEffect(() => {
        const albumSet = new Set();
        const yearSet = new Set();
        const artistSet = new Set();
        const genreSet = new Set();
        songs.forEach(s => {
            if (s.album) albumSet.add(s.album);
            if (s.release_date) {
                const y = s.release_date.split('-')[0];
                if (y) yearSet.add(y);
            }
            if (s.artist) artistSet.add(s.artist);
            if (s.genre) genreSet.add(s.genre);
        });
        setAlbums(Array.from(albumSet).sort());
        setYears(Array.from(yearSet).sort((a, b) => Number(b) - Number(a)));
        setArtists(Array.from(artistSet).map((name, idx) => ({ id: idx + 1, name })).sort((a, b) => a.name.localeCompare(b.name)));
        setGenres(Array.from(genreSet).sort());
    }, [songs]);

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
                            <div style={{ marginTop: 12 }}>
                                <button className="reset-filters-btn" onClick={() => {
                                    setFilterGenre('all'); setFilterArtist('all'); setFilterAlbum('all'); setFilterPopularityMin(0);
                                    setFilterDuration('any'); setFilterExplicit('all'); setFilterYear('all'); setSearchQuery('');
                                }}>Reset filters</button>
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
                                        {genres && genres.length > 0 ? (
                                            genres.map(g => <option key={g} value={g}>{g}</option>)
                                        ) : (
                                            <>
                                                <option value="Pop">Pop</option>
                                                <option value="Electronic">Electronic</option>
                                                <option value="Acoustic">Acoustic</option>
                                                <option value="Hip-Hop">Hip-Hop</option>
                                                <option value="Rock">Rock</option>
                                                <option value="Jazz">Jazz</option>
                                                <option value="Classical">Classical</option>
                                                <option value="Country">Country</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Artist:</label>
                                    <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className="filter-select">
                                        <option value="all">All Artists</option>
                                        {artists.map((artist) => <option key={artist.id} value={artist.name}>{artist.name}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Album:</label>
                                    <select value={filterAlbum} onChange={(e) => setFilterAlbum(e.target.value)} className="filter-select">
                                        <option value="all">All Albums</option>
                                        {albums.map((a) => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Min Popularity:</label>
                                    <input type="range" min="0" max="100" value={filterPopularityMin} onChange={(e) => setFilterPopularityMin(Number(e.target.value))} className="filter-range" />
                                    <span className="filter-value">{filterPopularityMin}</span>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Duration:</label>
                                    <select value={filterDuration} onChange={(e) => setFilterDuration(e.target.value)} className="filter-select">
                                        <option value="any">Any</option>
                                        <option value="short">Short (&lt; 3:00)</option>
                                        <option value="medium">Medium (3:00–5:00)</option>
                                        <option value="long">Long (&gt; 5:00)</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Explicit:</label>
                                    <select value={filterExplicit} onChange={(e) => setFilterExplicit(e.target.value)} className="filter-select">
                                        <option value="all">All</option>
                                        <option value="explicit">Explicit</option>
                                        <option value="clean">Clean</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Year:</label>
                                    <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="filter-select">
                                        <option value="all">All Years</option>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
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