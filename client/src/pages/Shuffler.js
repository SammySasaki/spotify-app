import { useState, useEffect } from 'react';
import { getAllPlaylists, shuffle, swapTracks } from '../spotifyAPI';
import { catchErrors } from '../utils';
import Button from 'react-bootstrap/Button';


const Shuffler = () => {
    const [playlists, setPlaylists] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const userPlaylists = await getAllPlaylists();
            setPlaylists(userPlaylists);
        };

        catchErrors(fetchData());
    }, []);
    return (
        <>
            <h1>Shuffler</h1>
            <p>Shuffle your playlists!</p>
            <ul>
                {playlists.map((playlist, i) => (
                    <li key={i} className="Shuffler-playlist">
                        <div className="Playlist-name">
                          {playlist.images.length && playlist.images[0] && (
                            <img className="Playlist-img" src={playlist.images[0].url} alt={playlist.name} />
                          )}
                          {playlist.name}
                        </div>
                        {/* reload is to update snapshot */}
                        <Button className="Shuffle-button" onClick={() => shuffle(playlist.id, playlist.snapshot_id)
                            .then(() => {
                                window.location.reload();
                                alert("done!")
                            })
                            .catch((error) => console.log(error))
                            }>Shuffle</Button>
                    </li>   
                ))}
            </ul>
        </>
    )
}

export default Shuffler;