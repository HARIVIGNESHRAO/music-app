'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CLIENT_ID = '24d1da23844348baa0d6fb0fc1d41c1c';
const REDIRECT_URI = 'https://localhost:3000/callback';
const SCOPES = 'user-read-private user-read-email streaming user-read-playback-state';

export default function SpotifyAuth({ onTokenChange }) {
    const [token, setToken] = useState(null);
    const router = useRouter();

    // PKCE helper functions
    const generateRandomString = (length) => {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from(crypto.getRandomValues(new Uint8Array(length)))
            .map((x) => possible[x % possible.length])
            .join('');
    };

    const sha256 = async (plain) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hash);
    };

    const base64encode = (input) => {
        return btoa(String.fromCharCode(...input))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            exchangeCodeForToken(code);
            router.replace('/');
        } else {
            const storedToken = localStorage.getItem('spotify_token');
            if (storedToken) {
                setToken(storedToken);
                onTokenChange(storedToken);
            }
        }
    }, [router]);

    const exchangeCodeForToken = async (code) => {
        const codeVerifier = localStorage.getItem('code_verifier');
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: REDIRECT_URI,
                    client_id: CLIENT_ID,
                    code_verifier: codeVerifier,
                }),
            });
            const data = await response.json();
            if (data.access_token) {
                localStorage.setItem('spotify_token', data.access_token);
                setToken(data.access_token);
                onTokenChange(data.access_token);
                localStorage.removeItem('code_verifier');
            } else {
                console.error('Token exchange failed:', data);
            }
        } catch (error) {
            console.error('Error exchanging code:', error);
        }
    };

    const handleLogin = async () => {
        const codeVerifier = generateRandomString(64);
        localStorage.setItem('code_verifier', codeVerifier);
        const hashed = await sha256(codeVerifier);
        const codeChallenge = base64encode(hashed);
        const authUrl = `https://accounts.spotify.com/authorize?` +
            `client_id=${CLIENT_ID}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `scope=${encodeURIComponent(SCOPES)}&` +
            `code_challenge_method=S256&` +
            `code_challenge=${codeChallenge}`;
        window.location.href = authUrl;
    };

    const handleLogout = () => {
        localStorage.removeItem('spotify_token');
        setToken(null);
        onTokenChange(null);
    };

    return (
        <div className="mb-4">
            {!token ? (
                <button
                    onClick={handleLogin}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                    Login with Spotify
                </button>
            ) : (
                <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            )}
        </div>
    );
}