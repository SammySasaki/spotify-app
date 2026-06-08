import axios from 'axios';
import { rNG } from './utils';

const LOCALSTORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp'
};

const LOCALSTORAGE_VALUES = {
    accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
    refreshToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.refreshToken),
    expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
    timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
};

const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = LOCALSTORAGE_VALUES;
    if (!accessToken || !timestamp) {
        return false;
    }
    const msElapsed = Date.now() - Number(timestamp);
    return (msElapsed / 1000 > Number(expireTime));
};

const refreshToken = async () => {
    try {
        if (!LOCALSTORAGE_VALUES.refreshToken || 
            LOCALSTORAGE_VALUES.refreshToken === 'undefined' || 
            (Date.now() - Number(LOCALSTORAGE_VALUES.timestamp)) < 1000
        ) {
            console.error('No refresh token available');
            logout();
        }
        const { data } = await axios({
            method: 'get',
            url: `/refresh_token?refresh_token=${LOCALSTORAGE_VALUES.refreshToken}`
        });
        window.localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, data.access_token);
        window.localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now());

        window.location.reload();
    } catch (e) {
        console.error(e);
    }
};

export const logout = (message) => {
    for (const property in LOCALSTORAGE_KEYS) {
        window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    window.location = message
        ? `${window.location.origin}?message=${encodeURIComponent(message)}`
        : window.location.origin;
}

// get access token from url
const getAccessToken = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const queryParams = {
      [LOCALSTORAGE_KEYS.accessToken]: urlParams.get('access_token'),
      [LOCALSTORAGE_KEYS.refreshToken]: urlParams.get('refresh_token'),
      [LOCALSTORAGE_KEYS.expireTime]: urlParams.get('expires_in'),
    };
    const hasError = urlParams.get('error');
    if (queryParams[LOCALSTORAGE_KEYS.accessToken] || hasError) {
        window.history.replaceState({}, document.title, '/');
    }
  
    // If there's an error OR the token in localStorage has expired, refresh the token
    if (hasError || hasTokenExpired() || LOCALSTORAGE_VALUES.accessToken === 'undefined') {
      refreshToken();
    }
  
    // If there is a valid access token in localStorage, use that
    if (LOCALSTORAGE_VALUES.accessToken && LOCALSTORAGE_VALUES.accessToken !== 'undefined') {
      return LOCALSTORAGE_VALUES.accessToken;
    }
  
    // If there is a token in the URL query params, user is logging in for the first time
    if (queryParams[LOCALSTORAGE_KEYS.accessToken]) {
        // Store the query params in localStorage
        for (const property in queryParams) {
           window.localStorage.setItem(property, queryParams[property]);
        }
        // Set timestamp
        window.localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now());
        // Return access token from query params
        return queryParams[LOCALSTORAGE_KEYS.accessToken];
    }
};

export const accessToken = getAccessToken();

axios.defaults.baseURL = 'https://api.spotify.com/v1';
axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
axios.defaults.headers.common['Content-Type'] = 'application/json';

axios.interceptors.response.use(null, error => {
    if (error.response?.status === 403) {
        window.dispatchEvent(new Event('spotify-unauthorized'));
    }
    return Promise.reject(error);
});

export const getUserProfile = () => axios.get('/me');

export const searchTracks = (query, limit = 5) =>
    axios.get(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);

export const getArtistsByIds = (ids) =>
    axios.get(`/artists?ids=${ids.join(',')}`);

export const createPlaylistFromTracks = async (name, uris) => {
    const user = await getUserProfile();
    const playlist = await axios.post(`/users/${user.data.id}/playlists`, { name });
    const id = playlist.data.id;
    for (let i = 0; i < uris.length; i += 100) {
        await axios.post(`/playlists/${id}/tracks`, { uris: uris.slice(i, i + 100) });
    }
    return id;
};

export const getPlaylists = (limit = 20) => {
    return axios.get(`/me/playlists?limit=${limit}`);
};

export const getAllPlaylists = async () => {
    var allPlaylists = [];
    var response = await axios.get(`/me/playlists`);
    allPlaylists = allPlaylists.concat(response.data.items)
    while (response.data.next) {
        response = await axios.get(response.data.next);
        allPlaylists = allPlaylists.concat(response.data.items)
    }
    return allPlaylists;
};

export const getPlaylistById = (playlist_id) => {
    return axios.get(`/playlists/${playlist_id}`);
};

// Fisher-Yates shuffle client-side, then replace playlist in batches of 100
export const shuffle = async function(id) {
    const tracks = await getAllTracks(id);
    const uris = tracks.filter(t => t.track).map(t => t.track.uri);

    for (let i = uris.length - 1; i > 0; i--) {
        const j = rNG(i);
        [uris[i], uris[j]] = [uris[j], uris[i]];
    }

    await axios.put(`/playlists/${id}/tracks`, { uris: uris.slice(0, 100) });
    for (let i = 100; i < uris.length; i += 100) {
        await axios.post(`/playlists/${id}/tracks`, { uris: uris.slice(i, i + 100) });
    }
}

export const getAllTracks = async (id) => {
    var allTracks = []
    var playlist = await getPlaylistById(id);
    allTracks = allTracks.concat(playlist.data.tracks.items)
    while (playlist.data.tracks.next) {
        playlist = await axios.get(playlist.data.tracks.next);
        allTracks = allTracks.concat(playlist.data.tracks.items)
    }
    return allTracks

}

const getArtistAlbums = async (id) => {
    return axios.get(`/artists/${id}/albums?include_groups=album,single`);
}

const getAllAlbums = async (id) => {
    var allAlbums = [];
    var albums = await getArtistAlbums(id);
    allAlbums = allAlbums.concat(albums.data.items);
    while (albums.data.next) {
        albums = await axios.get(albums.data.next);
        allAlbums = allAlbums.concat(albums.data.items)
    };
    return allAlbums;

}

// remove first track and add new track to end
export const replaceTrack = async function(id, uriRemove, uriAdd) {
    await axios.delete(`/playlists/${id}/tracks`, {data: {
        "tracks": [
            {
                "uri": uriRemove
            }
        ]
    }});
    return await axios.post(`/playlists/${id}/tracks?uris=${uriAdd}`);
}

// choose a random song from artist and return uri
const chooseSongFromArtist = async function(id) {
    const albums = await getAllAlbums(id);
    const randomNum = rNG(albums.length - 1);
    const chosenAlbum = albums[randomNum];
    const albumLen = chosenAlbum.total_tracks;
    const response = await axios.get(chosenAlbum.href);
    const randomNum2 = rNG(albumLen - 1);
    const newTrackURI = response.data.tracks.items[randomNum2].uri;
    return newTrackURI;
}

export const update = async function(id) {
    const playlist = await getPlaylistById(id);
    const size = playlist.data.tracks.total;
    const tracks = await getAllTracks(id);
    for (var i = 0; i < size; i++) {
        const artistID = tracks[i].track.artists[0].id
        const oldTrackURI = tracks[i].track.uri
        const newTrackURI = await chooseSongFromArtist(artistID);
        await replaceTrack(id, oldTrackURI, newTrackURI)
    }
}

export const restorePlaylist = async (id, uris) => {
    await axios.put(`/playlists/${id}/tracks`, { uris: uris.slice(0, 100) });
    for (let i = 100; i < uris.length; i += 100) {
        await axios.post(`/playlists/${id}/tracks`, { uris: uris.slice(i, i + 100) });
    }
};

export const getArtistID = async function(name) {
    return axios.get(`search?q=${name}&type=artist`);
}

// create empty playlist and return playlist ID
const createEmptyPlaylist = async function(name, desc) {
    const user = await getUserProfile();
    const userID = user.data.id;
    const data = {
        name: name,
        description: desc
    }
    const response = await axios.post(`/users/${userID}/playlists`, data);
    return response.data.id;
}

export const generatePlaylist = async function(ids, len, name, desc) {
    const length = parseInt(len);
    const newID = await createEmptyPlaylist(name, desc);

    const uris = [];
    for (let i = 0; i < length; i++) {
        uris.push(await chooseSongFromArtist(ids[i % ids.length]));
    }

    for (let i = 0; i < uris.length; i += 100) {
        await axios.post(`/playlists/${newID}/tracks`, { uris: uris.slice(i, i + 100) });
    }
}