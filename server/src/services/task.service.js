import Task from '../models/Task.js';

export const taskService = {
  async createTask(data) {
    const lastTask = await Task.findOne({
      boardId: data.boardId,
      columnId: data.columnId,
    }).sort({ position: -1 });
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

    const statusByColumn = {
      todo: 'To Do',
      inprogress: 'In Progress',
      done: 'Done',
    };
    const status = statusByColumn[targetColumnId];
    if (!status) throw new Error('Invalid target column');

    const targetTasks = await Task.find({
      boardId: task.boardId,
      columnId: targetColumnId,
      _id: { $ne: task._id },
    }).sort({ position: 1, _id: 1 });
    const insertIndex = newPosition === undefined
      ? targetTasks.length
      : targetTasks.findIndex((targetTask) => targetTask.position > newPosition);
    targetTasks.splice(insertIndex < 0 ? targetTasks.length : insertIndex, 0, task);

    task.columnId = targetColumnId;
    task.status = status;

    const operations = targetTasks.map((targetTask, index) => {
      const position = (index + 1) * 1000;
      if (targetTask._id.equals(task._id)) {
        task.position = position;
        return {
          updateOne: {
            filter: { _id: task._id },
            update: { $set: { columnId: targetColumnId, position, status } },
          },
        };
      }

      return {
        updateOne: {
          filter: { _id: targetTask._id },
          update: { $set: { position } },
        },
      };
    });

    await Task.bulkWrite(operations);

    return task;
  },

  async getTaskById(taskId) {
    return Task.findById(taskId);
  },

  async deleteTask(taskId) {
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) throw new Error('Task not found');
    return task;
  }
};