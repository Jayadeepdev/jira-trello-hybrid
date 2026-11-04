import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  columnId: z.string().min(1, 'Column ID is required'),
  dueDate: z.string().optional(),
  boardId: z.string().optional(),
  assignees: z.array(z.string()).optional()
});

export const moveTaskSchema = z.object({
  columnId: z.enum(['todo', 'inprogress', 'done']),
  position: z.number().min(0, 'Position must be a positive number').optional()
});