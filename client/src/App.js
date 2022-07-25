import './App.css';
import React, { useState, useEffect } from 'react';
import { accessToken, logout } from './spotifyAPI';
import 'bootstrap/dist/css/bootstrap.min.css';
import Button from 'react-bootstrap/Button';
import Navbar from "./Navigation/Navbar.js";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Login, Home, Shuffler, Updater, Creator } from './pages';

function App() {
  const [token, setToken] = useState(null);
  useEffect(() => {
    setToken(accessToken);
  }, []);
  return (
    <div className="App">
      <Navbar />
        {!token ? (
          <Login />
        ) : (
          <>
            <Button onClick={logout} variant="success" id="logout">Log Out</Button>
            <Router>
              <Routes>
                <Route path="/shuffler" element={<Shuffler />} />
                <Route path="/updater" element={<Updater />} />
                <Route path="/creator" element={<Creator />} />
                <Route path="/" element={<Home />} />
              </Routes>
            </Router>
          </>
        )}
    </div>
  );
}

export default App;
