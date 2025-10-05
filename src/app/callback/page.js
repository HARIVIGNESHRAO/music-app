'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Callback() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const url = new URL(window.location.href);
        const searchParams = new URLSearchParams(url.search);
        const hashParams = new URLSearchParams(url.hash.replace('#', ''));
        const code = searchParams.get('code') || hashParams.get('code');
        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');

        console.log('Callback URL:', url.href);
        console.log('Search Params:', Object.fromEntries(searchParams));
        console.log('Hash Params:', Object.fromEntries(hashParams));
        console.log('Code:', code, 'Verifier:', codeVerifier);

        if (code && codeVerifier) {
            axios.post('/api/auth/token', { code, codeVerifier })
                .then(response => {
                    const { access_token } = response.data;
                    if (access_token) {
                        window.localStorage.setItem('spotify_token', access_token);
                        router.push('/');
                    } else {
                        setError('No access token received');
                    }
                })
                .catch(err => {
                    console.error('Token exchange error:', err.response?.data || err.message);
                    setError('Failed to exchange code for token: ' + (err.response?.data?.error_description || err.message));
                })
                .finally(() => setLoading(false));
        } else if (hashParams.get('error')) {
            setError(`Spotify error: ${hashParams.get('error')}. ${hashParams.get('error_description') || 'Check redirect URI and auth settings.'}`);
            setLoading(false);
        } else {
            setError('No authorization code found');
            setLoading(false);
        }
    }, [router]);

    if (loading) return <div>Processing login...</div>;
    if (error) return <div>Error: {error}. <button onClick={() => router.push('/dashboard')}>Go Home</button></div>;

    return <div>Success! Redirecting...</div>;
}