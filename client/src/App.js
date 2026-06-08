import './App.css';
import { useState, useEffect } from 'react';
import { accessToken, logout } from './spotifyAPI';
import Navbar from "./Navigation/Navbar.js";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Login, Home, Shuffler, Updater, Creator, Discovery } from './pages';
import RequestAccessForm from './components/RequestAccessForm';

function App() {
  const [token, setToken] = useState(null);
  const [showUnauthorized, setShowUnauthorized] = useState(false);

  useEffect(() => {
    setToken(accessToken);
    const handleUnauthorized = () => setShowUnauthorized(true);
    window.addEventListener('spotify-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('spotify-unauthorized', handleUnauthorized);
  }, []);

  const handleCloseUnauthorized = () => {
    setShowUnauthorized(false);
    logout("You've been logged out. I'll email you once your access has been approved.");
  };

  return (
    <div className="App">
      <Router>
        <Navbar onLogout={token ? logout : null} />
        <Routes>
          <Route path="/discovery" element={token ? <Discovery /> : <Login />} />
          <Route path="/shuffler" element={token ? <Shuffler /> : <Login />} />
          <Route path="/updater" element={token ? <Updater /> : <Login />} />
          <Route path="/creator" element={token ? <Creator /> : <Login />} />
          <Route path="/" element={token ? <Home /> : <Login />} />
        </Routes>
      </Router>
      {showUnauthorized && (
        <div className="modal-overlay" onClick={handleCloseUnauthorized}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Access Required</h2>
            <p>Your Spotify account doesn't have access to this app yet. Request access below and you'll be added soon.</p>
            <RequestAccessForm />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleCloseUnauthorized}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
