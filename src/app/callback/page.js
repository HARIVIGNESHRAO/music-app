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
            }
        }
    }, [router]);
    return <div>Loading...</div>;
}