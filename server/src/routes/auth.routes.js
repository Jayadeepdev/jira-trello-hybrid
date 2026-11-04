import express from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/validationSchemas.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;