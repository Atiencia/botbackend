import { Router } from 'express';
import { getKnowledge, addKnowledge, deleteKnowledge } from '../controllers/knowledgeController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getKnowledge);
router.post('/', addKnowledge);
router.delete('/:id', deleteKnowledge);

export default router;
