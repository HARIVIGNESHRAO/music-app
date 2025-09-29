'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Callback() {
    const router = useRouter();

    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
            const token = hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1];
            if (token) {
                window.localStorage.setItem('spotify_token', token);
                router.push('/');
            } else {
                console.error('No access token found in hash:', hash);
            }
        } else {
            console.error('No hash parameter in URL');
        }
    }, [router]);

    return <div>Loading...</div>;
}