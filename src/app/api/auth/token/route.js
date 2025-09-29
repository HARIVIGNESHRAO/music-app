// app/api/auth/token/route.js
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const { code, codeVerifier } = await request.json();

        console.log('Received code:', code);
        console.log('Received codeVerifier:', codeVerifier);

        if (!code || !codeVerifier) {
            return NextResponse.json({ error: 'Missing code or verifier' }, { status: 400 });
        }

        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback';

        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: 'Missing client credentials in environment' }, { status: 500 });
        }

        const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
        console.log('Auth Header:', authHeader);

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: authHeader,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        console.log('Spotify Token Response Status:', tokenResponse.status);
        const tokenData = await tokenResponse.json();
        console.log('Spotify Token Response:', tokenData);

        if (!tokenResponse.ok) {
            return NextResponse.json({ error: tokenData.error_description || 'Token exchange failed' }, { status: tokenResponse.status });
        }

        return NextResponse.json(tokenData);
    } catch (error) {
        console.error('Token exchange error details:', error);
        return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
    }
}