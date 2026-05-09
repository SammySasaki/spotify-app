import { useState } from 'react';
import { getArtistID, generatePlaylist } from '../spotifyAPI';

const Creator = () => {
    const [playlistName, setPlaylistName] = useState('');
    const [playlistDesc, setPlaylistDesc] = useState('');
    const [artists, setArtists] = useState([]);
    const [currArtist, setCurrArtist] = useState('');
    const [length, setLength] = useState('');
    const [generating, setGenerating] = useState(false);

    const handleAddArtist = async (event) => {
        event.preventDefault();
        if (!currArtist.trim()) return;
        const response = await getArtistID(currArtist);
        const item = response.data.artists.items[0];
        if (!item) return alert('Artist not found');
        if (!artists.find(a => a.id === item.id)) {
            setArtists([...artists, { id: item.id, name: item.name }]);
        } else {
            alert('Artist already added');
        }
        setCurrArtist('');
    };

    const handleGenerate = async (event) => {
        event.preventDefault();
        setGenerating(true);
        try {
            await generatePlaylist(artists.map(a => a.id), length, playlistName, playlistDesc);
            alert('done');
            window.location.reload();
        } catch (error) {
            console.log(error);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="content">
            <h1 className="page-title">Creator</h1>
            <p className="page-subtitle">Build a playlist with your favorite artists</p>
            <div className="creator-section">
                <div className="form-block">
                    <h2>Playlist details</h2>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Name</label>
                            <input
                                className="form-input"
                                type="text"
                                value={playlistName}
                                onChange={(e) => setPlaylistName(e.target.value)}
                                placeholder="My playlist"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <input
                                className="form-input"
                                type="text"
                                value={playlistDesc}
                                onChange={(e) => setPlaylistDesc(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-block">
                    <h2>Artists</h2>
                    <form onSubmit={handleAddArtist}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Artist name</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={currArtist}
                                    onChange={(e) => setCurrArtist(e.target.value)}
                                    placeholder="Search artist…"
                                />
                            </div>
                            <button className="btn-action" type="submit">Add</button>
                        </div>
                    </form>
                    {artists.length > 0 && (
                        <ul className="artist-tags">
                            {artists.map((a, i) => (
                                <li key={i} className="artist-tag">{a.name}</li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="form-block">
                    <h2>Generate</h2>
                    <form onSubmit={handleGenerate}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Number of tracks</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="1"
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                    placeholder="20"
                                />
                            </div>
                            <button
                                className="btn-action"
                                type="submit"
                                disabled={generating || artists.length === 0 || !playlistName || !length}
                            >
                                {generating ? 'Generating…' : 'Generate'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Creator;
