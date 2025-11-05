import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js'
import {addProduct, getProducts, updateProduct, deleteProduct} from '../Controllers/productController.js';


const router = express.Router();

router.post('/add', authMiddleware, addProduct);
router.get('/', authMiddleware, getProducts);
router.put('/:id', authMiddleware, updateProduct); 
router.delete('/:id', authMiddleware, deleteProduct);

export default router 