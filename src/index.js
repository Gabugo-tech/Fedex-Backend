require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const trackingRouter = require('./routes/tracking');
const adminRouter    = require('./routes/admin');
const errorHandler   = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 4000;

// ===== SECURITY =====
app.use(helmet());

// CORS — allow all Vercel previews + explicit frontend URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / mobile
    // allow any vercel.app subdomain for preview deploys
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.options('*', cors()); // pre-flight

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

app.use(express.json());

// ===== ROUTES =====
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);
app.use('/api/track', trackingRouter);
app.use('/api/admin', adminRouter);

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, error: 'Route not found' })
);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 FedEx Tracker API running on port ${PORT}`);
});
