import { useState } from 'react';

const RequestAccessForm = () => {
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

    if (status === 'success') {
        return <p className="request-success">Request received! I'll email you once you've been added.</p>;
    }

    return (
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
            <button className="btn-action" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Submitting...' : 'Submit'}
            </button>
            {status === 'error' && (
                <p className="request-error">Something went wrong. Please try again.</p>
            )}
        </form>
    );
};

export default RequestAccessForm;
