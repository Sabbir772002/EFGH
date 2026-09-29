import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import stopsRouter from './routes/stops';
import routesRouter from './routes/routes';

export const app = express();

// ── Global middleware ──────────────────────────────────────────────────────
app.use(helmet());                   // security headers
app.use(cors());                     // allow cross-origin requests
app.use(express.json());             // parse JSON bodies
app.use(requestLogger);              // log every request

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dhaka-tesla-pool' });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',   authRouter);
app.use('/stops',  stopsRouter);
app.use('/routes', routesRouter);

// ── Central error handler (must be last) ───────────────────────────────────
app.use(errorHandler);

// ── Start server (only when run directly, not in tests) ───────────────────
if (require.main === module) {
  app.listen(Number(config.PORT), () => {
    console.log(`🚗 Dhaka Tesla Pool API running on port ${config.PORT}`);
  });
}
