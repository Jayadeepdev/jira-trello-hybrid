import { taskService } from '../services/task.service.js';

export const createTask = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const task = await taskService.createTask({ ...req.body, boardId });
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
    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    await taskService.deleteTask(taskId);
    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};