import { Router } from 'express';
import { getCustomers, toggleBotActive } from '../controllers/customersController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getCustomers);
router.post('/:instagram_user_id/toggle', toggleBotActive);

export default router;
