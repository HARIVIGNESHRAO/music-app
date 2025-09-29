'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Callback() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');

        if (code && codeVerifier) {
            // Exchange code for token via API route
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
                    console.error('Token exchange error:', err);
                    setError('Failed to exchange code for token');
                })
                .finally(() => setLoading(false));
        } else {
            setError('No authorization code found');
            setLoading(false);
        }
    }, [router]);

    if (loading) return <div>Processing login...</div>;
    if (error) return <div>Error: {error}. <button onClick={() => router.push('/')}>Go Home</button></div>;

    return <div>Success! Redirecting...</div>;
}