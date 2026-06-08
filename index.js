
require('dotenv').config()
const express = require('express');
const axios = require('axios');
const querystring = require('query-string');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const { Resend } = require('resend');
const app = express();

const resend = new Resend(process.env.RESEND_API_KEY);
const path = require('path');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const FRONTEND_URI = process.env.FRONTEND_URI;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const PORT = process.env.PORT || 8888;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
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

const getLastFmTags = async (name, artist) => {
    try {
        const trackRes = await axios.get('http://ws.audioscrobbler.com/2.0/', {
            params: {
                method: 'track.getTopTags',
                track: name,
                artist: artist,
                api_key: LASTFM_API_KEY,
                format: 'json',
                autocorrect: 1,
            }
        });
        const trackTags = (trackRes.data?.toptags?.tag || [])
            .slice(0, 15)
            .map(t => ({ name: t.name.toLowerCase().trim(), count: parseInt(t.count) || 0 }))
            .filter(t => t.count > 0);

        if (trackTags.length > 0) return trackTags;

        // Fall back to artist tags when track has no data
        const artistRes = await axios.get('http://ws.audioscrobbler.com/2.0/', {
            params: {
                method: 'artist.getTopTags',
                artist: artist,
                api_key: LASTFM_API_KEY,
                format: 'json',
                autocorrect: 1,
            }
        });
        return (artistRes.data?.toptags?.tag || [])
            .slice(0, 15)
            .map(t => ({ name: t.name.toLowerCase().trim(), count: parseInt(t.count) || 0 }))
            .filter(t => t.count > 0);
    } catch (e) {
        return [];
    }
};

const getLastFmSimilar = async (seeds) => {
    const results = [];
    for (const seed of seeds) {
        try {
            const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
                params: {
                    method: 'track.getSimilar',
                    track: seed.name,
                    artist: seed.artist,
                    api_key: LASTFM_API_KEY,
                    format: 'json',
                    limit: 40,
                }
            });
            const tracks = response.data?.similartracks?.track || [];
            tracks.forEach(t => results.push({
                name: t.name,
                artist: t.artist.name,
                score: parseFloat(t.match),
                source: 'lastfm',
            }));
        } catch (e) {
            console.error(`Last.fm lookup failed for "${seed.name}":`, e.message);
        }
    }
    return results;
};

const getClaudeSuggestions = async (seeds) => {
    const seedList = seeds.map(s => `"${s.name}" by ${s.artist}`).join(', ');
    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a music expert. Return only valid JSON, no explanation or markdown.',
        messages: [{
            role: 'user',
            content: `Given these seed tracks: ${seedList}, suggest 20 similar tracks that fans would enjoy. Prioritize lesser-known and deeper cuts over obvious hits. Return a JSON array of objects with "name" and "artist" fields only.`
        }]
    });

    try {
        const text = message.content[0].text;
        const match = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').match(/\[[\s\S]*\]/);
        if (!match) return [];
        const cleaned = match[0].replace(/\\'/g, "'").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        const json = JSON.parse(cleaned);
        return json.map(t => ({ name: t.name, artist: t.artist, source: 'ai', score: 0.7 }));
    } catch (e) {
        console.error('Failed to parse Claude suggestions:', e.message);
        return [];
    }
};

const REQUESTS_FILE = path.resolve(__dirname, 'requests.json');

app.post('/api/request-access', (req, res) => {
    const { name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    let requests = [];
    if (fs.existsSync(REQUESTS_FILE)) {
        try { requests = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8')); } catch {}
    }

    const entry = { name: name.trim(), email: email.trim(), submittedAt: new Date().toISOString() };
    requests.push(entry);
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));

    resend.emails.send({
        from: 'onboarding@resend.dev',
        to: process.env.GMAIL_USER,
        subject: 'Spotify App — New Access Request',
        text: `Name: ${entry.name}\nEmail: ${entry.email}\nSubmitted: ${entry.submittedAt}`,
    }).catch(err => console.error('Email send failed:', err.message));

    res.json({ ok: true });
});

app.post('/api/discover', async (req, res) => {
    const { seeds, exclude = [] } = req.body;
    if (!seeds?.length) return res.status(400).json({ error: 'seeds required' });

    try {
        // Phase 1: candidates + seed tags in parallel
        const [lastfmResults, claudeResults, rawSeedTags] = await Promise.all([
            getLastFmSimilar(seeds),
            getClaudeSuggestions(seeds),
            Promise.all(seeds.map(s => getLastFmTags(s.name, s.artist))),
        ]);

        // Merge seed tags by summing counts across all seeds
        const seedTagMap = {};
        rawSeedTags.forEach(seedTags =>
            seedTags.forEach(t => { seedTagMap[t.name] = (seedTagMap[t.name] || 0) + t.count; })
        );
        const seedTags = Object.entries(seedTagMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Deduplicate candidates, excluding seeds and already-shown tracks
        const seen = new Set([
            ...seeds.map(s => `${s.name}|${s.artist}`.toLowerCase()),
            ...exclude.map(e => `${e.name}|${e.artist}`.toLowerCase()),
        ]);
        const unique = [];
        for (const track of [...lastfmResults, ...claudeResults]) {
            const key = `${track.name}|${track.artist}`.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(track);
            }
        }

        // Phase 2: fetch tags for all candidates in parallel
        const candidateTags = await Promise.all(
            unique.map(c => getLastFmTags(c.name, c.artist))
        );
        const candidates = unique.map((c, i) => ({ ...c, tags: candidateTags[i] }));

        res.json({ candidates, seedTags });
    } catch (err) {
        console.error('/api/discover error:', err.message);
        res.status(500).json({ error: 'Discovery failed', detail: err.message });
    }
});

// All remaining requests return the React app, so it can handle routing
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, './client/build', 'index.html'));
});

app.listen(PORT, () => {
    const url = FRONTEND_URI || `http://127.0.0.1:${PORT}`;
    console.log(`Express app listening at ${url}`);
});