import { NextResponse } from 'next/server';

// Simple in-memory cache for search results
const CACHE = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

function cacheKeyForSearch(q, maxResults) {
  return `search:${q}:${maxResults}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const maxResults = parseInt(searchParams.get('maxResults') || '10', 10);

    if (!q) return NextResponse.json({ error: 'missing query' }, { status: 400 });

    const key = cacheKeyForSearch(q, maxResults);
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server missing YOUTUBE_API_KEY' }, { status: 500 });
    }

    // Step 1: search for videos
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('videoCategoryId', '10');
    searchUrl.searchParams.set('key', API_KEY);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const txt = await searchRes.text();
      return NextResponse.json({ error: 'YouTube search failed', details: txt }, { status: searchRes.status });
    }
    const searchJson = await searchRes.json();
    const videoIds = (searchJson.items || []).map(i => i.id?.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      CACHE.set(key, { data: [], timestamp: Date.now() });
      return NextResponse.json([]);
    }

    // Step 2: fetch details for the videos
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'contentDetails,snippet,statistics');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', API_KEY);

    const videosRes = await fetch(videosUrl.toString());
    if (!videosRes.ok) {
      const txt = await videosRes.text();
      return NextResponse.json({ error: 'YouTube videos fetch failed', details: txt }, { status: videosRes.status });
    }

    const videosJson = await videosRes.json();
    const items = videosJson.items || [];

    CACHE.set(key, { data: items, timestamp: Date.now() });

    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
