import { Router } from 'express';
const router = Router();

router.post('/pay', (req, res) => res.status(202).json({ status: 'PENDING' }));
router.post('/callback', (req, res) => res.status(200).json({ status: 'ACKNOWLEDGED' }));

export default router;
