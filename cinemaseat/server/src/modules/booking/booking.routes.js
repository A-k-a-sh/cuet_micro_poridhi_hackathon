import { Router } from 'express';
const router = Router();

router.post('/holds', (req, res) => res.json({ status: 'held' }));
router.get('/bookings/:id', (req, res) => res.json({ booking: null }));

export default router;
