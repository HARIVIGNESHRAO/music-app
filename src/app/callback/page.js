'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Callback() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        // Check query parameters first (Authorization Code Flow with PKCE)
        let code = new URLSearchParams(window.location.search).get('code');

        // Fallback to hash parameters (if legacy redirect occurs)
        if (!code) {
            const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
            code = hashParams.get('code') || hashParams.get('access_token'); // Handle token if misconfigured
        }

        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');

        if (code && codeVerifier) {
            console.log('Received code:', code); // Debug log
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
        } else {
            console.error('No code or verifier found:', { code, codeVerifier, search: window.location.search, hash: window.location.hash });
            setError('No authorization code found');
            setLoading(false);
        }
    }, [router]);

    if (loading) return <div>Processing login...</div>;
    if (error) return <div>Error: {error}. <button onClick={() => router.push('/')}>Go Home</button></div>;

    return <div>Success! Redirecting...</div>;
}