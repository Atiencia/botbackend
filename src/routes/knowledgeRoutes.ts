import { Router } from 'express';
import { getKnowledge, addKnowledge, deleteKnowledge, updateKnowledge } from '../controllers/knowledgeController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getKnowledge);
router.post('/', addKnowledge);
router.put('/:id', updateKnowledge);
router.delete('/:id', deleteKnowledge);

export default router;
