// app/api/auth/token/route.js
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const { code, codeVerifier } = await request.json();

        if (!code || !codeVerifier) {
            return NextResponse.json({ error: 'Missing code or verifier' }, { status: 400 });
        }

        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback';

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            return NextResponse.json({ error: errorData.error_description || 'Token exchange failed' }, { status: 400 });
        }

        const tokenData = await tokenResponse.json();
        return NextResponse.json(tokenData);
    } catch (error) {
        console.error('Token exchange error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}