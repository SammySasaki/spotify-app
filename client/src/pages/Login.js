import RequestAccessForm from '../components/RequestAccessForm';

const LOGIN_URI =
    process.env.NODE_ENV !== 'production'
        ? 'http://127.0.0.1:8888/login'
        : '/login';

const Login = () => {
    const message = new URLSearchParams(window.location.search).get('message');

    return (
        <div className="login-page">
            <h1>Spotify App</h1>
            <p>Manage and refresh your playlists</p>
            {message && <p className="request-success">{message}</p>}
            <a className="btn-login" href={LOGIN_URI}>Log in with Spotify</a>
            <div className="request-access">
                <h2>Request Access</h2>
                <RequestAccessForm />
            </div>
        </div>
    );
};

export default Login;
