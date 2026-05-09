import { useState, useEffect } from 'react';
import { getAllPlaylists, getAllTracks, update, restorePlaylist } from '../spotifyAPI';
import { catchErrors } from '../utils';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

const UNDO_KEY = (id) => `undo_update_${id}`;

const Updater = () => {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
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
        setUpdatingId(playlist.id);
        try {
            const tracks = await getAllTracks(playlist.id);
            const uris = tracks.filter(t => t.track).map(t => t.track.uri);
            sessionStorage.setItem(UNDO_KEY(playlist.id), JSON.stringify(uris));

            await update(playlist.id);
            setToast({ message: `"${playlist.name}" updated`, playlistId: playlist.id });
        } catch (error) {
            console.log(error);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUndo = async () => {
        const { playlistId } = toast;
        const uris = JSON.parse(sessionStorage.getItem(UNDO_KEY(playlistId)));
        setToast(null);
        setUpdatingId(playlistId);
        try {
            await restorePlaylist(playlistId, uris);
            sessionStorage.removeItem(UNDO_KEY(playlistId));
            setToast({ message: 'Tracks restored' });
        } catch (error) {
            console.log(error);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="content">
            <h1 className="page-title">Updater</h1>
            <p className="page-subtitle">Swap every track with another by the same artist</p>
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
                                disabled={updatingId !== null}
                            >
                                {updatingId === playlist.id ? 'Updating…' : 'Update'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {pendingPlaylist && (
                <ConfirmModal
                    message={`Update "${pendingPlaylist.name}"? Every track will be replaced with another by the same artist.`}
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

export default Updater;
