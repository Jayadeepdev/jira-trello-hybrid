import express from 'express';
import { createTask, getBoardTasks, moveTask, deleteTask } from '../controllers/task.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, moveTaskSchema } from '../validators/validationSchemas.js';

const router = express.Router();

router.use(protect); // Secure all task routes

router.get('/board/:boardId', getBoardTasks);
router.post('/board/:boardId', validate(createTaskSchema), createTask);
router.patch('/:taskId/move', validate(moveTaskSchema), moveTask);
router.delete('/:taskId', deleteTask);

export default router;