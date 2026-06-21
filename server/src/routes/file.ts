import { Router } from 'express';
import { uploadFile, getRoomFiles, downloadFile } from '../controllers/file';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/upload', authenticate as any, upload.single('file'), uploadFile as any);
router.get('/room/:roomId', authenticate as any, getRoomFiles as any);
router.get('/download/:filename', downloadFile as any);

export default router;
