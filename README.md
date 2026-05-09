## Spotify App
App that allows users to manage their playlists. Users can shuffle existing playlists, update them by replacing each song with songs by the same artist, and create new playlists with songs from specified artists.

Link: https://spotify-app-ss.herokuapp.com

Technologies used: Spotify API, React, Express, Heroku

Unfortunately you can't use your spotify account unless I approve it :(.

## Discovery

The Discovery page is an AI-powered music recommendation engine built on top of Spotify and Last.fm. Unlike Spotify's built-in DJ, it is fully transparent and human-in-the-loop — you can see why songs are recommended and steer the results in real time.

### How it works

**1. Anchor selection**
Pick 1–5 songs as reference points. These define the sonic and semantic space you want to explore.

**2. Candidate generation (backend)**
Two sources run in parallel for each anchor:
- **Last.fm `track.getSimilar`** — returns up to 100 tracks co-listened with your anchors by the Last.fm community, each with a similarity score
- **Claude (claude-sonnet-4-6)** — suggests 20 lesser-known tracks a fan of your anchors would enjoy

**3. Feature vector construction**
Each track is represented as a weighted vector built from three complementary sources:
- **Last.fm tags** (community-sourced): genre, mood, and descriptor labels (e.g. `"indie"`, `"melancholic"`, `"female vocalists"`) with counts up to 100. Falls back to artist-level tags for obscure tracks.
- **Spotify artist genres** (algorithm-sourced): Spotify's own granular genre taxonomy (e.g. `"chillwave"`, `"synth-pop"`, `"bedroom pop"`), weighted at 50
- **Release decade** (temporal): bucketed release year (e.g. `"1990s"`, `"2010s"`), weighted at 30

All three share a single vocabulary and are L2-normalized to unit vectors before comparison.

**4. Cosine similarity ranking**
The seed centroid is the normalized sum of all anchor tag vectors. Each candidate is scored by cosine similarity against this centroid — higher means more tag overlap. Results are sorted and filtered by the exploration radius slider.

**5. Human-in-the-loop feedback**
- **`+`** shifts the centroid toward that track's vector (weight 0.2) and re-ranks everything
- **`−`** shifts the centroid away and hides the track
- The centroid is re-normalized after each shift to stay on the unit sphere

**6. Find more**
Accumulates all seen tracks across multiple clicks and excludes them from the next backend call. Liked tracks are preserved. Each run pulls a fresh batch from the remaining Last.fm pool and a new set of Claude suggestions.

### Other audio feature sources considered

| Source | Signal | Status |
|--------|--------|--------|
| Spotify audio features | BPM, energy, valence, danceability | Deprecated for new apps (Nov 2024) |
| AcousticBrainz | Open-source audio analysis | Shut down 2022 |
| Last.fm `track.getInfo` | Play count / listener count (obscurity signal) | Available — easy addition |
| Genius + LLM | Lyrical mood, themes, sentiment extracted by Claude | Available — high latency |
| MusicBrainz tags | Community tags, different bias than Last.fm | Available — adds vocabulary diversity |
| Discogs style/genre | Highly specific genre taxonomy | Available — good for electronic/niche genres |

The most practical next addition would be **Last.fm play count** as a normalized obscurity dimension, or **Genius lyrics → Claude mood extraction** for a lyrical signal that none of the above APIs provide.

## Screenshots

![Home](/images/Home.png "Home Page")

![Shuffler](/images/Shuffler.png "Shuffler Page")

![Updater](/images/Updater.png "Updater Page")

![Creator](/images/Creator.png "Creator Page")