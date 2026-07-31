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

// Configuración requerida por Vercel para express-rate-limit (trust proxy)
app.set('trust proxy', 1);

// Configuración de Rate Limiter
// Limitamos a 100 peticiones cada 15 minutos por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Aplicamos el limiter globalmente
app.use(limiter);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/bot-config', botConfigRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/simulate', simulateRoutes);

// Ruta de Health Check - ayuda a verificar que el servidor está vivo
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Eli Bot Backend is running' });
});

// Exportamos app para Vercel Serverless Functions
// module.exports es necesario para que @vercel/node lo reconozca correctamente
module.exports = app;
export default app;

// Solo iniciamos el servidor local si NO estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    logger.info(`Server running on port ${port} (Supabase setup complete)`);
  });
}
