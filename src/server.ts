import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './config/logger';

// Rutas
import botConfigRoutes from './routes/botConfigRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import chatsRoutes from './routes/chatsRoutes';
import webhookRoutes from './routes/webhookRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/bot-config', botConfigRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/webhook', webhookRoutes);

// Exportamos app para Vercel Serverless Functions
export default app;

// Solo iniciamos el servidor local si NO estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    logger.info(`Server running on port ${port} (Supabase setup complete)`);
  });
}
