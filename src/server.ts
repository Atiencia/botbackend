import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { logger } from './config/logger';

// Rutas
import botConfigRoutes from './routes/botConfigRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import chatsRoutes from './routes/chatsRoutes';
import webhookRoutes from './routes/webhookRoutes';
import customersRoutes from './routes/customersRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import simulateRoutes from './routes/simulateRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Trust proxy para rate limiter detrás de Vercel
app.set('trust proxy', 1);

// Primero CORS, luego Rate Limit
app.use(cors());

// Rate Limiter: 1000 peticiones cada 15 minutos por IP (dashboard hace polling)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.use(limiter);
app.use(express.json());

// API Routes
app.use('/api/bot-config', botConfigRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/simulate', simulateRoutes);

// Health Check
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Eli Bot Backend is running' });
});

// Exportamos para Vercel Serverless
module.exports = app;
export default app;

// Solo arrancamos el servidor en desarrollo local
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}
