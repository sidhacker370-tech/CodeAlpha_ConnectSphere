import { Router } from 'express';
import { register, login, refresh, logout, getProfile, getMeetingHistory } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/profile', authenticate as any, getProfile as any);
router.get('/history', authenticate as any, getMeetingHistory as any);

export default router;
