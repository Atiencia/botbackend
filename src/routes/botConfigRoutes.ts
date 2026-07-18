import { Router } from 'express';
import { getBotConfig, updateBotConfig } from '../controllers/botConfigController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// Todas estas rutas requieren estar autenticado
router.use(requireAuth);

router.get('/', getBotConfig);
router.post('/', updateBotConfig);

export default router;
