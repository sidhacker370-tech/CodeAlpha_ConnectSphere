import { Router } from 'express';
import { createRoom, joinRoom, getRoom } from '../controllers/room';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/create', authenticate as any, createRoom as any);
router.post('/join', authenticate as any, joinRoom as any);
router.get('/:roomCode', authenticate as any, getRoom as any);

export default router;
