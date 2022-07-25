import Button from 'react-bootstrap/Button';

const LOGIN_URI = 
    process.env.NODE_ENV !== 'production'
        ? 'http://localhost:8888/login'
        : 'https://spotify-app-ss.herokuapp.com/login';

const Login = () => (
    <Button href={LOGIN_URI} variant="success">
        Log in to Spotify
    </Button>
);

export default Login;