import { taskService } from '../services/task.service.js';
import AuditLog from '../models/AuditLog.js';

export const createTask = async (req, res, next) => {
  try {
    const boardId = req.params.boardId || req.body.boardId;
    if (!boardId) {
      return res.status(400).json({ success: false, message: 'A board is required to create a task.' });
    }

    const task = await taskService.createTask({
      ...req.body,
      boardId,
      createdBy: req.user.id,
      dueDate: req.body.dueDate || undefined,
    });

    // Log audit event
    await AuditLog.create({
      type: 'TASK',
      action: 'TASK_CREATED',
      details: `Created task "${task.title}" in column [${task.columnId}].`,
      performedBy: req.user.id,
      taskId: task._id,
    });

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const getBoardTasks = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const tasks = await taskService.getTasksByBoard(boardId);
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

export const moveTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { columnId, position } = req.body;
    const updatedTask = await taskService.updateTaskPosition(taskId, columnId, position);

    // Log audit event
    await AuditLog.create({
      type: 'TASK',
      action: 'TASK_MOVED',
      details: `Moved task "${updatedTask.title}" to ${updatedTask.status} at position ${updatedTask.position}.`,
      performedBy: req.user.id,
      taskId: updatedTask._id,
    });

    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    // Enforce Admin role verification for deletion
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { taskId } = req.params;
    const task = await taskService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    await taskService.deleteTask(taskId);

    // Log audit event
    await AuditLog.create({
      type: 'TASK',
      action: 'TASK_DELETED',
      details: `Deleted task "${task.title}" (${task._id}) by user ${req.user.id}.`,
      performedBy: req.user.id,
      taskId: task._id,
    });

    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};