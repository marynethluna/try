import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sanitizeInput } from './middleware/sanitize.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import placeRoutes from './routes/place.routes.js';
import itemRoutes from './routes/item.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import borrowRoutes from './routes/borrow.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/report.routes.js';
import activityRoutes from './routes/activity.routes.js';
import settingsRoutes from './routes/settings.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // the SPA is served from the same origin; CSP is handled by the host
    crossOriginEmbedderPolicy: false,
    frameguard: false, // allow the platform preview to embed the app in an iframe
  })
);

/**
 * Strict CORS allow-list.
 *
 * Cross-origin reads are only permitted for the configured CLIENT_ORIGIN values
 * and host preview URLs. Same-origin requests (the SPA served by this very
 * server) are always allowed. Disallowed origins simply receive no CORS headers,
 * which is what makes the browser block the cross-origin read.
 */
const configuredOrigins = [process.env.CLIENT_ORIGIN, process.env.PUBLIC_ORIGIN, process.env.APP_ORIGIN]
  .filter(Boolean)
  .flatMap((value) => String(value).split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.e2b\.app$/i;

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, same-origin navigation.
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      // Sandbox live-preview hosts.
      if (PREVIEW_ORIGIN.test(origin)) return callback(null, true);
      // Disallowed origins get no CORS headers — the browser blocks the read.
      return callback(null, false);
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(sanitizeInput);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'school-inventory-api', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity-logs', activityRoutes);
app.use('/api/settings', settingsRoutes);

// Serve the built React application when it exists.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'School Inventory API is running. Build the React client to serve the UI.',
      docs: '/api/health',
    });
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
