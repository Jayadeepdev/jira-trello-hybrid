import { create } from 'zustand';
import { api } from '../api/axios';

export const useBoardStore = create((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (boardId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/tasks/board/${boardId}`);
      set({ tasks: response.data.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch tasks', loading: false });
    }
  },

  moveTaskOptimistic: async (taskId, targetColumnId, newPosition) => {
    // 1. Optimistic local update for instant UI feedback
    const previousTasks = get().tasks;
    set({
      tasks: get().tasks.map((task) =>
        task._id === taskId ? { ...task, columnId: targetColumnId, position: newPosition } : task
      ),
    });

    try {
      // 2. Background API sync
      await api.patch(`/tasks/${taskId}/move`, { columnId: targetColumnId, position: newPosition });
    } catch (error) {
      // 3. Rollback on failure
      set({ tasks: previousTasks, error: 'Failed to update task position' });
    }
  },
}));