import { Router } from 'express';
import { simulateChat } from '../controllers/simulateController';

const router = Router();

// Endpoint publico, no usa authMiddleware
router.post('/', simulateChat);

export default router;
