import { useState, useEffect } from 'react';
import { getAllPlaylists, getAllTracks, shuffle, restorePlaylist } from '../spotifyAPI';
import { catchErrors } from '../utils';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

const UNDO_KEY = (id) => `undo_shuffle_${id}`;

const Shuffler = () => {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shufflingId, setShufflingId] = useState(null);
    const [pendingPlaylist, setPendingPlaylist] = useState(null);
    const [toast, setToast] = useState(null); // { message, playlistId? }

    useEffect(() => {
        const fetchData = async () => {
            const userPlaylists = await getAllPlaylists();
            setPlaylists(userPlaylists);
            setLoading(false);
        };
        catchErrors(fetchData)();
    }, []);

    const handleConfirm = async () => {
        const playlist = pendingPlaylist;
        setPendingPlaylist(null);
        setShufflingId(playlist.id);
        try {
            const tracks = await getAllTracks(playlist.id);
            const uris = tracks.filter(t => t.track).map(t => t.track.uri);
            sessionStorage.setItem(UNDO_KEY(playlist.id), JSON.stringify(uris));

            await shuffle(playlist.id);
            setToast({ message: `"${playlist.name}" shuffled`, playlistId: playlist.id });
        } catch (error) {
            console.log(error);
        } finally {
            setShufflingId(null);
        }
    };

    const handleUndo = async () => {
        const { playlistId } = toast;
        const uris = JSON.parse(sessionStorage.getItem(UNDO_KEY(playlistId)));
        setToast(null);
        setShufflingId(playlistId);
        try {
            await restorePlaylist(playlistId, uris);
            sessionStorage.removeItem(UNDO_KEY(playlistId));
            setToast({ message: 'Order restored' });
        } catch (error) {
            console.log(error);
        } finally {
            setShufflingId(null);
        }
    };

    return (
        <div className="content">
            <h1 className="page-title">Shuffler</h1>
            <p className="page-subtitle">Shuffle your playlists</p>
            {loading ? (
                <p className="loading-text">Loading playlists…</p>
            ) : (
                <ul className="playlist-list">
                    {playlists.map((playlist, i) => (
                        <li key={i} className="playlist-row">
                            {playlist.images?.length && playlist.images[0]
                                ? <img className="playlist-img" src={playlist.images[0].url} alt={playlist.name} />
                                : <div className="playlist-img-placeholder" />
                            }
                            <span className="playlist-name">{playlist.name}</span>
                            <button
                                className="btn-action"
                                onClick={() => setPendingPlaylist(playlist)}
                                disabled={shufflingId !== null}
                            >
                                {shufflingId === playlist.id ? 'Shuffling…' : 'Shuffle'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {pendingPlaylist && (
                <ConfirmModal
                    message={`Shuffle "${pendingPlaylist.name}"? This will permanently reorder all tracks.`}
                    onConfirm={handleConfirm}
                    onCancel={() => setPendingPlaylist(null)}
                />
            )}
            {toast && (
                <Toast
                    message={toast.message}
                    onDone={() => setToast(null)}
                    onUndo={toast.playlistId ? handleUndo : null}
                />
            )}
        </div>
    );
};

export default Shuffler;
