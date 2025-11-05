import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js'
import {getSummary} from '../Controllers/dashboardController.js';

const router = express.Router();

router.get('/', authMiddleware, getSummary);

export default router 