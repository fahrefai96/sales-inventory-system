import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js'
import {addCategory, getCategorys, updateCategory, deleteCategory} from '../Controllers/categoryController.js';


const router = express.Router();

router.get('/', authMiddleware, getCategorys);
router.post('/add', authMiddleware, addCategory);
router.put('/:id', authMiddleware, updateCategory); 
router.delete('/:id', authMiddleware, deleteCategory);

export default router 