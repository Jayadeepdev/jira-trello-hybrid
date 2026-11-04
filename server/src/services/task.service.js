import { Task } from '../models/Task.js';

export const taskService = {
  async createTask(data) {
    // Find the highest position in the target column to place the new task at the end
    const lastTask = await Task.findOne({ columnId: data.columnId }).sort({ position: -1 });
    const position = lastTask ? lastTask.position + 1000 : 1000;

    const task = await Task.create({
      ...data,
      position,
    });
    return task;
  },

  async getTasksByBoard(boardId) {
    return await Task.find({ boardId }).sort({ position: 1 });
  },

  async updateTaskPosition(taskId, targetColumnId, newPosition) {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    task.columnId = targetColumnId;
    task.position = newPosition;
    await task.save();

    return task;
  },

  async deleteTask(taskId) {
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) throw new Error('Task not found');
    return task;
  }
};