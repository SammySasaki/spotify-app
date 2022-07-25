
require('dotenv').config()
const express = require('express');
const axios = require('axios');
const querystring = require('query-string');
const app = express();
const path = require('path');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const FRONTEND_URI = process.env.FRONTEND_URI;
const PORT = process.env.PORT || 8888;

app.use(express.static(path.resolve(__dirname, './client/build')));

app.get('/', (req, res) => {
    res.send("Hello World!");
});


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const stateKey = 'spotify_auth_state';

// request authorization code
app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);
    const scope = [
        'user-read-private',
        'user-read-email', 
        'playlist-modify-public',
        'user-top-read'
    ].join(' ');

    res.redirect('https://accounts.spotify.com/authorize?'+
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: state,
      scope: scope,
    }));
})

// on callback, use authorization code to get access token
app.get('/callback', (req, res) => {
    const code = req.query.code || null;

    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
    }).then(response => {
        if (response.status == 200) {
            const { access_token, refresh_token, expires_in } = response.data;

            // redirect to react app
            const queryParams = querystring.stringify({
                access_token,
                refresh_token,
                expires_in
            });

            res.redirect(`${FRONTEND_URI}?${queryParams}`)


        } else {
            res.redirect(`/?${querystring.stringify({ error: 'invalid_token' })}`);
        }
    }).catch(error => {
        res.send(error.response.data);
    });
})

// get new access token
app.get('/refresh_token', (req, res) => {
    const { refresh_token } = req.query;

    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token', 
        data: querystring.stringify({
            grant_type:'refresh_token',
            refresh_token: refresh_token
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        }
    }).then(response => {
        res.send(response.data);
    }).catch(error => {
        res.send(error.response.data);
    });
});

// All remaining requests return the React app, so it can handle routing
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, './client/build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Express app listening at http://localhost:${PORT}`);
});