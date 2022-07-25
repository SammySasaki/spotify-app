import { useState, useEffect } from 'react';
import { getAllPlaylists, update } from '../spotifyAPI';
import { catchErrors } from '../utils';
import Button from 'react-bootstrap/Button';

// rename css classes

const Updater = () => {
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
            <h1>Updater</h1>
            <p>Bored of your playlist? Update it by swapping every track with another by the same artist!</p>
            <ul>
                {playlists.map((playlist, i) => (
                    <li key={i} className="Shuffler-playlist">
                        <div className="Playlist-name">
                          {playlist.images.length && playlist.images[0] && (
                            <img className="Playlist-img" src={playlist.images[0].url} alt={playlist.name} />
                          )}
                          {playlist.name}
                        </div>
                        <Button className="Shuffle-button" onClick={() => update(playlist.id)
                            .then(() => alert("done!"))
                            .catch((error) => console.log(error))
                            }>Update</Button>
                    </li>   
                ))}
            </ul>
        </>
    )
}

export default Updater;