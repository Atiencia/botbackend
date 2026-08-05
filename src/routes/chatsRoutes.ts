import { Router } from 'express';
import { getChats, sendChatMessage } from '../controllers/chatsController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getChats);
router.post('/send', sendChatMessage);

export default router;
