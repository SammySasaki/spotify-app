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
        <Routes>
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/shuffler" element={token ? <Shuffler /> : <Login />} />
          <Route path="/updater" element={token ? <Updater /> : <Login />} />
          <Route path="/creator" element={token ? <Creator /> : <Login />} />
          <Route path="/" element={token ? <Home /> : <Login />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
