import { Router } from 'express';
import { getAnalytics } from '../controllers/analyticsController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAnalytics);

export default router;
