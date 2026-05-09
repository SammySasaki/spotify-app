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

function App() {
  const [token, setToken] = useState(null);
  useEffect(() => {
    setToken(accessToken);
  }, []);
  return (
    <div className="App">
      <Router>
        <Navbar onLogout={token ? logout : null} />
        {!token ? (
          <Login />
        ) : (
          <Routes>
            <Route path="/shuffler" element={<Shuffler />} />
            <Route path="/updater" element={<Updater />} />
            <Route path="/creator" element={<Creator />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/" element={<Home />} />
          </Routes>
        )}
      </Router>
    </div>
  );
}

export default App;
