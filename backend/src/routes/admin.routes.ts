import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';

const router = Router();

router.post('/reset', (req, res) => adminController.resetDatabase(req, res));

export default router;
