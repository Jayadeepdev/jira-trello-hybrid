import express from 'express';
import Task from '../models/Task.js';
import { protect } from '../middleware/auth.js'; // Your JWT auth middleware
import { validate } from '../middleware/validate.js';
import { createTaskSchema, moveTaskSchema } from '../validators/validationSchemas.js';
import { createTask, getBoardTasks, moveTask, deleteTask } from '../controllers/task.controller.js';

const router = express.Router();

router.use(protect); // Require authentication for all task routes

// Board-scoped API used by the dashboard, mounted at /api/boards.
router.get('/:boardId/tasks', getBoardTasks);
router.post('/:boardId/tasks', validate(createTaskSchema), createTask);

// Task API aliases used by the dashboard and existing board store.
router.get('/board/:boardId', getBoardTasks);
router.patch('/:taskId/move', validate(moveTaskSchema), moveTask);

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().populate('createdBy', 'name role');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
router.post('/', validate(createTaskSchema), createTask);

// Update task (Edit details, status, or move columns)
router.patch('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status, title, description, priority } = req.body;

    // Rule Check: Non-admins cannot move tasks to 'Done'
    if (status === 'Done' && req.user.role !== 'admin' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admin can do this' });
    }

    // Rule Check: Non-admins cannot edit title, description, or priority
    if ((title !== undefined || description !== undefined || priority !== undefined) && req.user.role !== 'admin' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admin can edit task details' });
    }

    if (status !== undefined) task.status = status;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;

    task.history.push({
      action: `Updated task by ${req.user.name} (Role: ${req.user.role})`,
      performedBy: req.user.id
    });

    await task.save();
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:taskId', deleteTask);

export default router;