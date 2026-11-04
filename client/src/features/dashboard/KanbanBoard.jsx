import React, { useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBoardStore } from '../../store/useBoardStore';

function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task._id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <h4 className="font-medium text-gray-800">{task.title}</h4>
      {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs px-2 py-1 rounded font-medium ${
          task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
          task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
          task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
        }`}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

export function KanbanBoard({ boardId, columns }) {
  const { tasks, fetchTasks, moveTaskOptimistic, loading } = useBoardStore();

  useEffect(() => {
    if (boardId) fetchTasks(boardId);
  }, [boardId, fetchTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id;
    const task = tasks.find((t) => t._id === activeTaskId);
    if (!task) return;

    // Determine target column (if dropped on a column or another task)
    let targetColumnId = over.id;
    const targetTask = tasks.find((t) => t._id === over.id);
    if (targetTask) {
      targetColumnId = targetTask.columnId;
    }

    if (task.columnId !== targetColumnId || active.id !== over.id) {
      const columnTasks = tasks.filter((t) => t.columnId === targetColumnId);
      const newPosition = columnTasks.length > 0 ? columnTasks[columnTasks.length - 1].position + 1000 : 1000;
      moveTaskOptimistic(activeTaskId, targetColumnId, newPosition);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading board tasks...</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 overflow-x-auto p-6 min-h-[80vh] bg-gray-50">
        {columns.map((column) => {
          const columnTasks = tasks.filter((t) => t.columnId === column._id);
          return (
            <div key={column._id} className="w-80 bg-gray-100 rounded-xl p-4 flex flex-col shrink-0 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">{column.title}</h3>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {columnTasks.length}
                </span>
              </div>
              <SortableContext items={columnTasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 min-h-[200px]">
                  {columnTasks.map((task) => (
                    <TaskCard key={task._id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}