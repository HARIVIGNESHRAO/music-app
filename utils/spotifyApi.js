import SpotifyWebApi from 'spotify-web-api-js';

const spotifyApi = new SpotifyWebApi();

export const setAccessToken = (token) => {
    spotifyApi.setAccessToken(token);
};

export const searchTracks = async (query) => {
    return await spotifyApi.searchTracks(query, { limit: 10 });
};

export const getTrackPreview = (track) => track.preview_url;