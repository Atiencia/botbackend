import { Router } from 'express';
import { getChats } from '../controllers/chatsController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getChats);

export default router;
