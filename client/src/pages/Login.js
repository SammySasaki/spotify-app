const LOGIN_URI =
    process.env.NODE_ENV !== 'production'
        ? 'http://127.0.0.1:8888/login'
        : '/login';

const Login = () => (
    <div className="login-page">
        <h1>Spotify App</h1>
        <p>Manage and refresh your playlists</p>
        <a className="btn-login" href={LOGIN_URI}>Log in with Spotify</a>
    </div>
);

export default Login;
