import { Link, NavLink } from 'react-router-dom';

const Navbar = ({ onLogout }) => (
    <nav className="app-navbar">
        <Link className="nav-brand" to="/">Spotify App</Link>
        <ul className="nav-links">
            <li><NavLink to="/" end>Home</NavLink></li>
            <li><NavLink to="/shuffler">Shuffler</NavLink></li>
            <li><NavLink to="/updater">Updater</NavLink></li>
            <li><NavLink to="/creator">Creator</NavLink></li>
            <li><NavLink to="/discovery">Discovery</NavLink></li>
        </ul>
        {onLogout && (
            <button className="btn-logout" onClick={onLogout}>Log out</button>
        )}
    </nav>
);

export default Navbar;