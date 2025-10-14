'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import { Play, Music } from 'lucide-react';
import './page.css';
import { use } from 'react';

export default function SharedPlaylist({ params }) {
    const { id } =use(params);
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backendserver-edb4bafdgxcwg7d5.centralindia-01.azurewebsites.net';
    const DEFAULT_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center';
    const router = useRouter();

    useEffect(() => {
        const fetchSharedPlaylist = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/shared/playlist/${id}?token=${token}`);
                setPlaylist(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load shared playlist');
                setLoading(false);
            }
        };
        if (id && token) {
            fetchSharedPlaylist();
        } else {
            setError('Invalid share link');
            setLoading(false);
        }
    }, [id, token]);

    const playSong = (song) => {
        console.log('Playing song:', song.title);
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error-text">{error}</p>
                <button onClick={() => router.push('/')} className="back-btn">Back to Home</button>
            </div>
        );
    }

    if (!playlist) {
        return <div className="error-container">No playlist found</div>;
    }

    return (
        <div className="shared-playlist-container">
            <h1 className="playlist-title">{playlist.name}</h1>
            <Image
                src={playlist.cover || DEFAULT_COVER}
                alt={playlist.name}
                width={300}
                height={300}
                className="playlist-cover"
            />
            <p className="playlist-info">{playlist.songs.length} songs</p>
            {playlist.songs.length > 0 ? (
                <div className="songs-list">
                    {playlist.songs.map((song, index) => (
                        <div key={song.id} className="song-item" onClick={() => playSong(song)}>
                            <span className="song-number">{index + 1}</span>
                            <Image
                                src={song.cover || DEFAULT_COVER}
                                alt={song.title}
                                width={50}
                                height={50}
                                className="song-cover"
                            />
                            <div className="song-info">
                                <h4>{song.title}</h4>
                                <p>{song.artist} • {song.album}</p>
                            </div>
                            <span className="song-duration">{song.duration}</span>
                            <button className="play-btn">
                                <Play className="play-icon" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-playlist">
                    <Music className="empty-icon" />
                    <p>No songs in this playlist</p>
                </div>
            )}
        </div>
    );
}