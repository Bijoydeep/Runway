require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resume');

const app = express();

// CORS — only needed when the frontend is hosted on a different origin
// (e.g. local dev with a separate dev server). In production the frontend
// is served as static files from this same process, so CORS is not required.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length) {
  app.use(cors({ origin: allowedOrigins, credentials: true }));
}

app.use(express.json({ limit: '1mb' }));

// API routes
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);

// Serve the frontend (HTML/CSS/JS) as static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — any non-API route returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler (e.g. multer file-type/size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Runway backend listening on port ${PORT}`));
