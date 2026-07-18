import { Router } from 'express';
import { verifyWebhook, handleIncomingMessage } from '../controllers/webhookController';

const router = Router();

// Endpoint para que Meta valide el Webhook
router.get('/', verifyWebhook);

// Endpoint para recibir los mensajes de Instagram/Messenger
router.post('/', handleIncomingMessage);

export default router;
