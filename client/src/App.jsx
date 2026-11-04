import React from 'react';
import { KanbanBoard } from './features/dashboard/KanbanBoard';

export default function App() {
  const mockBoardId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const mockColumns = [
    { _id: "col-1", title: "To Do", order: 1 },
    { _id: "col-2", title: "In Progress", order: 2 },
    { _id: "col-3", title: "Done", order: 3 },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">Jira / Trello Hybrid Dashboard</h1>
        <span className="text-sm bg-purple-600/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full font-medium">
          Phase 4: Frontend & DnD Active
        </span>
      </header>
      <main>
        <KanbanBoard boardId={mockBoardId} columns={mockColumns} />
      </main>
    </div>
  );
}