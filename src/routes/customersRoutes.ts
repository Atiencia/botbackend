import { Router } from 'express';
import { getCustomers, toggleBotActive } from '../controllers/customersController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getCustomers);
router.post('/:instagram_user_id/toggle', toggleBotActive);

export default router;
