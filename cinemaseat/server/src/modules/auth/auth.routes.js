import { Router } from 'express';
const router = Router();

router.post('/register', (req, res) => res.json({ message: 'Auth register route' }));
router.post('/login', (req, res) => res.json({ message: 'Auth login route' }));

export default router;
