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
            (Date.now() - Number(LOCALSTORAGE_VALUES.timestamp) / 1000) < 1000
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

export const logout = () => {
    for (const property in LOCALSTORAGE_KEYS) {
        window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    window.location = window.location.origin
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
axios.defaults.headers['Authorization'] = `Bearer ${accessToken}`;
axios.defaults.headers['Content-Type'] = 'application/json';

export const getUserProfile = () => axios.get('/me');

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

// swap track #trackNum and #size (0 index)
export const swapTracks = async (id, size, trackNum, snapshot) => {
    const data = {
        range_start: trackNum,
        insert_before: size,
        range_length: 1,
        snapshot_id: snapshot
    };
    const response = await axios.put(`/playlists/${id}/tracks`, data)
    var tempSnap = response.snapshot_id;
    const data2 = {
        range_start: size - 2,
        insert_before: trackNum,
        range_length: 1,
        snapshot_id: tempSnap
    };
    return await axios.put(`/playlists/${id}/tracks`, data2);
}


// Fisher-Yates shuffle
export const shuffle = async function(id, snapshot) {
    var currSnap = snapshot;
    const response = await getPlaylistById(id);
    var size = response.data.tracks.total;
    var currSize = size;
    for (var i = 0; i < size - 1; i++) {
      var trackNum = rNG(currSize);
      const response2 = await swapTracks(id, currSize, trackNum, currSnap);
      currSnap = response2.snapshot_id;
      currSize--;
    };
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
    const numArtists = ids.length;
    const length = parseInt(len);
    var counter = 0;
    const newID = await createEmptyPlaylist(name, desc);
    for (var i = 0; i < length; i++) {
        const artistID = ids[counter];
        const songURI = await chooseSongFromArtist(artistID);
        await axios.post(`/playlists/${newID}/tracks?uris=${songURI}`);
        if (counter == numArtists - 1) {
            counter = 0
        } else {
            counter++
        };
    }

}