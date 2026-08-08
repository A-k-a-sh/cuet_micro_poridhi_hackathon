import { Router } from 'express';
const router = Router();

router.get('/movies', (req, res) => res.json({ movies: [] }));
router.get('/theatres', (req, res) => res.json({ theatres: [] }));
router.get('/shows/:showId/seats', (req, res) => res.json({ seats: [] }));

export default router;
