import express from 'express';
import cors from 'cors';
import { env } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import stopsRoutes from './routes/stops';
import routesRoutes from './routes/routes';
import fareRoutes from './routes/fare';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/stops', stopsRoutes);
app.use('/api/v1/routes', routesRoutes);
app.use('/api/v1/fare', fareRoutes);

// Centralized error handling
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`🚀 Dhaka Tesla Pool Backend listening on port ${env.PORT}`);
  });
}

export default app;
