import { useState } from 'react';
import { getArtistID, generatePlaylist } from '../spotifyAPI';

const Creator = () => {
    const [playlistName, setPlaylistName] = useState('');
    const [playlistDesc, setPlaylistDesc] = useState('');
    const [artistIDs, setArtistIDs] = useState([]);
    const [artistNames, setArtistNames] = useState([]);
    const [currArtist, setCurrArtist] = useState('');
    const [length, setLength] = useState(0)


    const handleSubmit = async (event) => {
        event.preventDefault();
        const response = await getArtistID(currArtist);
        const name = response.data.artists.items[0].name;
        if (!artistNames.includes(name)) {
            setArtistIDs(artistIDs.concat([response.data.artists.items[0].id]))
            setArtistNames(artistNames.concat([name]))
        } else {
            alert("artist already added");
        }
        setCurrArtist('');
    }

    const startCreation = async (event) => {
        event.preventDefault();
        await generatePlaylist(artistIDs, length, playlistName, playlistDesc)
        .then(alert("done"))
        .catch((error) => console.log(error));
    }


    return (
        <>
            <h1>Creator</h1>
            <p>Build a playlist with your favorite artists!</p>
            
            <div>
                <label className="Creator-text">
                    Playlist Name:
                    <input type="text" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} />
                </label>
                <label className="Creator-text">
                    Playlist Description:
                    <input type="text" value={playlistDesc} onChange={(e) => setPlaylistDesc(e.target.value)} />
                </label>
            </div>
            <form onSubmit={handleSubmit}>
                <label className="Creator-text">
                    Artist:
                    <input type="text" value={currArtist} onChange={(e) => setCurrArtist(e.target.value)} />
                </label>
                <input className="Creator-button" type="submit" value="Add" />
            </form>
            <form onSubmit={startCreation}>
                <label className="Creator-text">
                    Length:
                    <input type="text" value={length} onChange={(e) => setLength(e.target.value)} />
                </label>
                <input className="Creator-button" type="submit" value="Generate Playlist" />
            </form>

            <h1>Artists Selected</h1>
            <ul>
                {artistNames.map((artist, i) => (
                    <li key={i}  className="Artist-list">{artist}</li>   
                ))}
            </ul>
        </>
    )
}

export default Creator;