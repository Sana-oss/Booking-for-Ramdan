/**
 * Express application (no network or database side effects on import).
 * server.js connects to MongoDB and starts listening.
 */
const config = require('./config/env');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { rejectOperatorKeys } = require('./middleware/security');
const { errorHandler } = require('./utils/errors');

mongoose.set('runValidators', true); // enforce schema validation on updates too

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');

app.set('trust proxy', 'loopback'); // Cloudflare Tunnel connector runs on this host
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // All scripts, fonts and libraries are served from this origin
      // (frontend/vendor). No inline <script> and no on*="" handlers: an
      // injected script tag or attribute cannot run. Inline style attributes
      // are still allowed (low risk; many remain in the markup).
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'", 'data:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': config.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : false }));
app.use(express.json({ limit: '20kb' }));
app.use(rejectOperatorKeys);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));

app.get('/health', (req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ status: up ? 'OK' : 'DEGRADED', mongodb: up ? 'Connected' : 'Disconnected' });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  // Never serve docs/config/scripts that may sit next to the pages
  if (/\.(md|ya?ml|sh|conf|lst|env|example|txt|json)$/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(frontendPath, { dotfiles: 'deny', index: 'index.html' }));

const pages = {
  '/': 'index.html',
  '/admin': 'admin-dashboard.html',
  '/check-status': 'check-status.html',
  '/success': 'success.html',
  '/admin-login': 'admin-login.html',
  '/archives': 'archives.html',
  '/users-management': 'users-management.html',
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(frontendPath, file)));
});
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

app.use(errorHandler);

module.exports = app;
