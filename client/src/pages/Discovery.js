import { useState, useRef } from 'react';
import { searchTracks, getArtistsByIds, createPlaylistFromTracks } from '../spotifyAPI';

const normalizeVector = (v) => {
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return mag ? v.map(x => x / mag) : v;
};

const buildTagVocab = (allTagArrays) =>
    Array.from(new Set(allTagArrays.flat().map(t => t.name)));

const tagsToVector = (tags, vocab) => {
    const tagMap = Object.fromEntries(tags.map(t => [t.name, t.count]));
    return vocab.map(v => tagMap[v] || 0);
};

const withConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let idx = 0;
    const worker = async () => {
        while (idx < items.length) {
            const i = idx++;
            results[i] = await fn(items[i]);
            await new Promise(r => setTimeout(r, 75));
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

const cosineSim = (a, b) => {
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return magA && magB ? dot / (magA * magB) : 0;
};

const Discovery = () => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [anchors, setAnchors] = useState([]);
    const [explorationRadius, setExplorationRadius] = useState(50);
    const [sources, setSources] = useState({ lastfm: true, ai: true });
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [seenTracks, setSeenTracks] = useState([]);
    const [centroid, setCentroid] = useState(null);
    const [showSave, setShowSave] = useState(false);
    const [playlistName, setPlaylistName] = useState('');
    const [saving, setSaving] = useState(false);
    const searchTimeout = useRef(null);

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(searchTimeout.current);
        if (!val.trim()) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await searchTracks(val);
                setSearchResults(res.data.tracks.items.map(t => ({
                    id: t.id,
                    name: t.name,
                    artist: t.artists[0].name,
                    artistId: t.artists[0].id,
                    releaseYear: t.album.release_date?.split('-')[0],
                    uri: t.uri,
                    image: t.album.images[2]?.url,
                })));
            } catch (err) {
                console.error(err);
            }
        }, 300);
    };

    const addAnchor = (track) => {
        if (anchors.find(a => a.id === track.id)) return;
        setAnchors(prev => [...prev, track]);
        setQuery('');
        setSearchResults([]);
    };

    const removeAnchor = (id) => setAnchors(prev => prev.filter(a => a.id !== id));

    const runDiscovery = async (exclude = [], keep = []) => {
        setLoading(true);
        setCandidates(keep);
        try {
            // Step 1: fetch candidates + seed tags from backend (Last.fm + AI)
            const response = await fetch('/api/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seeds: anchors.map(a => ({ name: a.name, artist: a.artist })),
                    exclude,
                }),
            });
            const { candidates: raw, seedTags } = await response.json();

            const filtered = raw.filter(c =>
                (sources.lastfm && c.source === 'lastfm') ||
                (sources.ai && c.source === 'ai')
            );

            // Step 2: enrich seed tags with Spotify artist genres + release decade
            const anchorArtistIds = [...new Set(anchors.map(a => a.artistId).filter(Boolean))];
            const anchorGenreMap = {};
            for (let i = 0; i < anchorArtistIds.length; i += 50) {
                const res = await getArtistsByIds(anchorArtistIds.slice(i, i + 50));
                res.data.artists.forEach(a => { if (a) anchorGenreMap[a.id] = a.genres; });
            }
            const enrichedSeedTags = [...seedTags];
            anchors.forEach(a => {
                (anchorGenreMap[a.artistId] || []).forEach(g =>
                    enrichedSeedTags.push({ name: g.toLowerCase(), count: 50 })
                );
                if (a.releaseYear) enrichedSeedTags.push({
                    name: `${Math.floor(parseInt(a.releaseYear) / 10) * 10}s`,
                    count: 30,
                });
            });

            // Step 3: resolve candidates to Spotify to get URIs for playback
            const resolved = (await withConcurrency(filtered, 3, async (c) => {
                try {
                    let res = await searchTracks(`track:"${c.name}" artist:"${c.artist}"`);
                    let t = res.data.tracks.items[0];
                    if (!t) {
                        res = await searchTracks(`${c.name} ${c.artist}`);
                        t = res.data.tracks.items[0];
                    }
                    if (!t) return null;
                    return { ...c, uri: t.uri, image: t.album.images[2]?.url, artistId: t.artists[0].id, releaseYear: t.album.release_date?.split('-')[0] };
                } catch {
                    return null;
                }
            })).filter(Boolean);

            // Step 4: enrich candidate tags with Spotify artist genres + release decade
            const candidateArtistIds = [...new Set(resolved.map(c => c.artistId).filter(Boolean))];
            const candidateGenreMap = {};
            for (let i = 0; i < candidateArtistIds.length; i += 50) {
                const res = await getArtistsByIds(candidateArtistIds.slice(i, i + 50));
                res.data.artists.forEach(a => { if (a) candidateGenreMap[a.id] = a.genres; });
            }
            const enrichedCandidates = resolved.map(c => ({
                ...c,
                tags: [
                    ...(c.tags || []),
                    ...(candidateGenreMap[c.artistId] || []).map(g => ({ name: g.toLowerCase(), count: 50 })),
                    ...(c.releaseYear ? [{ name: `${Math.floor(parseInt(c.releaseYear) / 10) * 10}s`, count: 30 }] : []),
                ],
            }));

            // Step 5: build shared vocabulary and seed centroid, then rank by cosine similarity
            const newVocab = buildTagVocab([enrichedSeedTags, ...enrichedCandidates.map(c => c.tags)]);
            const seedCentroid = normalizeVector(tagsToVector(enrichedSeedTags, newVocab));
            setCentroid(seedCentroid);

            const ranked = enrichedCandidates
                .map(c => {
                    const vector = normalizeVector(tagsToVector(c.tags, newVocab));
                    return { ...c, similarity: cosineSim(seedCentroid, vector), vector, feedback: null };
                })
                .sort((a, b) => b.similarity - a.similarity);

            // Recompute vectors for kept candidates in the new vocab, then prepend them
            const keptUpdated = keep.map(c => {
                const vector = normalizeVector(tagsToVector(c.tags || [], newVocab));
                return { ...c, similarity: cosineSim(seedCentroid, vector), vector };
            });
            setCandidates([...keptUpdated, ...ranked]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDiscover = () => {
        setSeenTracks([]);
        runDiscovery();
    };
    const handleFindMore = () => {
        const liked = candidates.filter(c => c.feedback === 'up');
        const allSeen = [...seenTracks, ...candidates.map(c => ({ name: c.name, artist: c.artist }))];
        setSeenTracks(allSeen);
        runDiscovery(allSeen, liked);
    };

    const handleFeedback = (trackKey, direction) => {
        if (!centroid) return;
        const track = candidates.find(c => `${c.name}|${c.artist}` === trackKey);
        if (!track?.vector || track.feedback === direction) return;

        const WEIGHT = 0.2;
        const sign = direction === 'up' ? 1 : -1;
        const newCentroid = normalizeVector(
            centroid.map((v, i) => v + sign * WEIGHT * (track.vector[i] - v))
        );
        setCentroid(newCentroid);

        setCandidates(prev =>
            prev
                .map(c => ({
                    ...c,
                    feedback: `${c.name}|${c.artist}` === trackKey ? direction : c.feedback,
                    similarity: c.vector ? cosineSim(newCentroid, c.vector) : c.similarity,
                }))
                .sort((a, b) => b.similarity - a.similarity)
        );
    };

    const handleSave = async () => {
        if (!playlistName.trim()) return;
        setSaving(true);
        try {
            const minSim = 0.7 - (explorationRadius / 100) * 0.6;
            const uris = candidates
                .filter(c => c.feedback !== 'down' && (c.similarity >= minSim || c.feedback === 'up'))
                .map(c => c.uri);
            await createPlaylistFromTracks(playlistName, uris);
            setShowSave(false);
            setPlaylistName('');
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const minSim = 0.7 - (explorationRadius / 100) * 0.6;
    const visible = candidates.filter(c =>
        c.feedback !== 'down' && (c.similarity >= minSim || c.feedback === 'up')
    );

    return (
        <div className="content">
            <h1 className="page-title">Discovery</h1>
            <p className="page-subtitle">Find new songs using your taste as a compass</p>

            <div className="form-block" style={{ marginBottom: '1rem' }}>
                <h2>Anchor tracks</h2>
                <div className="discovery-search">
                    <input
                        className="form-input"
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Search for a song to anchor from..."
                    />
                    {searchResults.length > 0 && (
                        <ul className="search-dropdown">
                            {searchResults.map(t => (
                                <li key={t.id} className="search-result" onClick={() => addAnchor(t)}>
                                    {t.image
                                        ? <img src={t.image} alt="" className="result-img" />
                                        : <div className="result-img-placeholder" />
                                    }
                                    <div className="result-text">
                                        <span className="result-name">{t.name}</span>
                                        <span className="result-artist">{t.artist}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {anchors.length > 0 && (
                    <ul className="anchor-list">
                        {anchors.map(a => (
                            <li key={a.id} className="anchor-chip">
                                <span>{a.name} — {a.artist}</span>
                                <button className="chip-remove" onClick={() => removeAnchor(a.id)}>×</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="form-block" style={{ marginBottom: '1rem' }}>
                <h2>Controls</h2>
                <div className="controls-row">
                    <div className="form-group">
                        <label>Exploration — {explorationRadius}%</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={explorationRadius}
                            onChange={e => setExplorationRadius(Number(e.target.value))}
                            className="range-input"
                        />
                        <div className="range-labels">
                            <span>Similar</span>
                            <span>Adventurous</span>
                        </div>
                    </div>
                    <div className="source-toggles">
                        <label className="source-toggle-label">
                            <input
                                type="checkbox"
                                checked={sources.lastfm}
                                onChange={e => setSources(s => ({ ...s, lastfm: e.target.checked }))}
                            />
                            Last.fm
                        </label>
                        <label className="source-toggle-label">
                            <input
                                type="checkbox"
                                checked={sources.ai}
                                onChange={e => setSources(s => ({ ...s, ai: e.target.checked }))}
                            />
                            AI picks
                        </label>
                    </div>
                </div>
                <button
                    className="btn-action"
                    onClick={handleDiscover}
                    disabled={loading || anchors.length === 0}
                >
                    {loading ? 'Searching...' : 'Find similar'}
                </button>
            </div>

            {candidates.length > 0 && (
                <div className="form-block">
                    <div className="results-header">
                        <h2>Results ({visible.length})</h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={handleFindMore} disabled={loading}>
                                {loading ? 'Searching...' : 'Find more'}
                            </button>
                            <button className="btn-action" onClick={() => setShowSave(true)}>
                                Save as playlist
                            </button>
                        </div>
                    </div>
                    <ul className="candidate-list">
                        {visible.map(c => {
                            const key = `${c.name}|${c.artist}`;
                            return (
                                <li key={key} className={`candidate-row${c.feedback ? ` feedback-${c.feedback}` : ''}`}>
                                    {c.image
                                        ? <img src={c.image} alt="" className="result-img" />
                                        : <div className="result-img-placeholder" />
                                    }
                                    <div className="candidate-info">
                                        <span className="result-name">{c.name}</span>
                                        <span className="result-artist">{c.artist}</span>
                                    </div>
                                    <span className={`source-badge source-${c.source}`}>
                                        {c.source === 'lastfm' ? 'Last.fm' : 'AI'}
                                    </span>
                                    <span className="similarity-score">{Math.round(c.similarity * 100)}%</span>
                                    <div className="feedback-btns">
                                        <button
                                            className={`feedback-btn${c.feedback === 'up' ? ' active-up' : ''}`}
                                            onClick={() => handleFeedback(key, 'up')}
                                            title="More like this"
                                        >+</button>
                                        <button
                                            className={`feedback-btn${c.feedback === 'down' ? ' active-down' : ''}`}
                                            onClick={() => handleFeedback(key, 'down')}
                                            title="Less like this"
                                        >−</button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {showSave && (
                <div className="modal-overlay" onClick={() => setShowSave(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Save as playlist</h2>
                        <p>Saves {visible.length} tracks to a new Spotify playlist.</p>
                        <input
                            className="form-input"
                            type="text"
                            value={playlistName}
                            onChange={e => setPlaylistName(e.target.value)}
                            placeholder="Playlist name"
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowSave(false)}>Cancel</button>
                            <button
                                className="btn-action"
                                onClick={handleSave}
                                disabled={saving || !playlistName.trim()}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Discovery;
