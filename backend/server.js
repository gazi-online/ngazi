const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// ── SECURITY MIDDLEWARE ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks, etc.)
    if (!origin) return callback(null, true);

    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://ngazi-delta.vercel.app',
    ].filter(Boolean);

    // Also allow any *.vercel.app subdomain dynamically
    const isVercel = origin.endsWith('.vercel.app');

    if (allowed.includes(origin) || isVercel) return callback(null, true);
    return callback(new Error('CORS not allowed: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts.' }
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Too many booking attempts.' }
});

app.use(globalLimiter);
app.use(morgan('combined'));

// ── BODY PARSING ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── DATABASE CONNECTION ─────────────────────────────────────────
const supabase = require('./config/supabase');
console.log('✅ Supabase Client Initialized');

// ── ROUTES ──────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/bookings', bookingLimiter, require('./routes/bookings'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/otp', require('./routes/otp'));

// ── HEALTH CHECK ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Gazi Online API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Gazi Online Backend API (Supabase Edition) is Active',
    docs: 'https://ngazi-delta.vercel.app'
  });
});

// ── ERROR HANDLER ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use('*', (req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    suggestion: 'Are you using the correct API endpoint?' 
  });
});

// ── START ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Gazi Online API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
