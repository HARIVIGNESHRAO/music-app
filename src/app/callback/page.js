'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Callback() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/'); // Redirect to home after auth
    }, [router]);

    return <div>Redirecting...</div>;
}