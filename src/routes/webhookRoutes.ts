import { Router } from 'express';
import { verifyWebhook, handleIncomingMessage } from '../controllers/webhookController';
import { verifyWhatsAppWebhook, handleWhatsAppIncomingMessage } from '../controllers/whatsappController';

const router = Router();

// Endpoint para que Meta valide el Webhook
router.get('/', verifyWebhook);

// Endpoint para recibir los mensajes de Instagram/Messenger
router.post('/', handleIncomingMessage);

// WhatsApp
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppIncomingMessage);

export default router;
