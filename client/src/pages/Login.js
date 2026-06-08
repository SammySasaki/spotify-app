import { useState } from 'react';

const LOGIN_URI =
    process.env.NODE_ENV !== 'production'
        ? 'http://127.0.0.1:8888/login'
        : '/login';

const Login = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState(null);

    const handleRequest = async (e) => {
        e.preventDefault();
        setStatus('loading');
        try {
            const res = await fetch('/api/request-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            });
            if (!res.ok) throw new Error();
            setStatus('success');
            setName('');
            setEmail('');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="login-page">
            <h1>Spotify App</h1>
            <p>Manage and refresh your playlists</p>
            <a className="btn-login" href={LOGIN_URI}>Log in with Spotify</a>

            <div className="request-access">
                <h2>Request Access</h2>
                {status === 'success' ? (
                    <p className="request-success">Request received! You'll be added soon.</p>
                ) : (
                    <form onSubmit={handleRequest}>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                        <input
                            className="form-input"
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        <button
                            className="btn-action"
                            type="submit"
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? 'Submitting...' : 'Submit'}
                        </button>
                        {status === 'error' && (
                            <p className="request-error">Something went wrong. Please try again.</p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
