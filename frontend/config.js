window.CONFIG = {
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : window.location.hostname.includes('replit.dev')
    ? window.location.origin
    : window.location.origin,

  SOCKET_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : window.location.hostname.includes('replit.dev')
    ? window.location.origin
    : window.location.origin,

  ENVIRONMENT: (window.location.hostname === 'localhost' || window.location.hostname.includes('replit.dev')) ? 'development' : 'production',

  APP_NAME: 'Zync',
  APP_TAGLINE: 'Tap. Share. Zync.',
  APP_DESCRIPTION: 'Your Socials. One Tap. Infinite Connections.'
};

// Socket.IO CDN configuration - using multiple fallback URLs
window.SOCKET_IO_CDN_URLS = [
    'https://cdn.socket.io/4.7.2/socket.io.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js',
    'https://unpkg.com/socket.io-client@4.7.2/dist/socket.io.min.js'
];