import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_URL = 'http://localhost:5000/api';

const parseApiResponse = async (response) => {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      `The API returned an invalid response (HTTP ${response.status}). Check that the request reached the backend API.`
    );
  }
};

function SortableTaskCard({ task, children }) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ id: task._id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : 'transform 220ms cubic-bezier(0.2, 0, 0, 1)',
      }}
      {...attributes}
      {...listeners}
      className={`touch-none cursor-grab rounded-xl border border-slate-800/90 bg-[#0b0f19] p-4 shadow-lg transition-[border-color,box-shadow] duration-200 hover:border-slate-700 active:cursor-grabbing ${
        isDragging ? 'opacity-20' : ''
      }`}
    >
      {children}
    </div>
  );
}

function DroppableColumn({ id, className, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `column:${id}` });

  return (
    <div
      ref={setNodeRef}
      className={`transition-shadow duration-200 ${className} ${isOver ? 'ring-2 ring-indigo-500/60' : ''}`}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const moveInProgress = useRef(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [boardId, setBoardId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Navigation View State ('dashboard' or 'profile')
  const [currentView, setCurrentView] = useState('dashboard');
  const [profileTab, setProfileTab] = useState('overview'); // 'overview' | 'approvals' | 'history'
  const [historyTab, setHistoryTab] = useState('tasks'); // 'tasks' | 'security'

  // Admin & Audit State
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState({ taskLogs: [], securityLogs: [] });

  // Task Creation Modal / Form State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: ['Bearer', token].join(' ') },
        });
        const data = await parseApiResponse(res);
        if (!res.ok) throw new Error(data.message || 'Could not load your account.');
        if (!data.data?.boardId) throw new Error('No board is assigned to this account.');

        if (!cancelled) {
          setUser(data.data);
          setBoardId(data.data.boardId);
          localStorage.setItem('boardId', data.data.boardId);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    fetchCurrentUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !boardId) return undefined;

    let cancelled = false;
    const loadTasks = async () => {
      try {
        const res = await fetch(`${API_URL}/boards/${boardId}/tasks`, {
          headers: { Authorization: ['Bearer', token].join(' ') },
        });
        const data = await parseApiResponse(res);
        if (!res.ok) throw new Error(data.message || 'Could not load board tasks.');
        if (!cancelled) setTasks(data.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    loadTasks();
    return () => {
      cancelled = true;
    };
  }, [token, boardId]);

  useEffect(() => {
    if (!token || currentView !== 'profile') return undefined;

    let cancelled = false;
    const loadProfileData = async () => {
      try {
        if (user?.role === 'Admin' || user?.role === 'admin') {
          const pendingResponse = await fetch(`${API_URL}/admin/pending-admins`, {
            headers: { Authorization: ['Bearer', token].join(' ') },
          });
          const pendingData = await parseApiResponse(pendingResponse);
          if (!pendingResponse.ok) {
            throw new Error(pendingData.message || 'Could not load admin requests.');
          }
          if (!cancelled) setPendingAdmins(pendingData.data || []);
        }

        const auditResponse = await fetch(`${API_URL}/admin/audit-logs`, {
          headers: { Authorization: ['Bearer', token].join(' ') },
        });
        const auditData = await parseApiResponse(auditResponse);
        if (!auditResponse.ok) throw new Error(auditData.message || 'Could not load audit logs.');
        if (!cancelled) {
          setAuditLogs(auditData.data || { taskLogs: [], securityLogs: [] });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    loadProfileData();
    return () => {
      cancelled = true;
    };
  }, [token, currentView, profileTab, user?.role]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(isLogin ? {} : { name }) }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || 'Authentication failed');

      setToken(data.token);
      localStorage.setItem('token', data.token);
      setUser(data.data);
      setBoardId(data.boardId);
      localStorage.setItem('boardId', data.boardId);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setBoardId('');
    setCurrentView('dashboard');
    localStorage.clear();
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/boards/${boardId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || 'Could not load board tasks.');
      setTasks(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchPendingAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/pending-admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res);
      if (res.ok) setPendingAdmins(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res);
      if (res.ok) setAuditLogs(data.data || { taskLogs: [], securityLogs: [] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestAdmin = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/admin/request-admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProcessAdmin = async (userId, action) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/admin/process-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, action }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message);
      setSuccess(data.message);
      fetchPendingAdmins();
      fetchAuditLogs();
    } catch (err) {
      setError(err.message);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!boardId) {
      setError('Your board is still loading. Please try again in a moment.');
      return;
    }

    try {
      setError('');
      const res = await fetch(`${API_URL}/boards/${boardId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, priority, dueDate, columnId: 'todo' }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || 'Failed to create task');

      setTitle('');
      setDescription('');
      setDueDate('');
      setShowTaskModal(false);
      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || 'Failed to delete task');
      fetchTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority || 'Medium');
    setError('');
  };

  const saveTaskChanges = async (event) => {
    event.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    try {
      setError('');
      const res = await fetch(`${API_URL}/tasks/${editingTask._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', token].join(' '),
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          priority: editPriority,
        }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to update task');

      setTasks((currentTasks) => currentTasks.map((task) => (
        task._id === editingTask._id ? data.data || data : task
      )));
      setEditingTask(null);
      setSuccess('Task updated successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const moveTask = async (taskId, newColumnId, position) => {
    if (moveInProgress.current) return;

    const task = tasks.find((item) => item._id === taskId);
    if (!task || !['todo', 'inprogress', 'done'].includes(newColumnId)) return;

    const targetTasks = tasks
      .filter((item) => item.columnId === newColumnId && item._id !== taskId)
      .sort((a, b) => a.position - b.position);
    const newPosition = position ?? (targetTasks.at(-1)?.position ?? 0) + 1000;
    const statusByColumn = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };

    moveInProgress.current = true;
    setError('');
    setTasks((currentTasks) => currentTasks.map((item) => (
      item._id === taskId
        ? { ...item, columnId: newColumnId, position: newPosition, status: statusByColumn[newColumnId] }
        : item
    )).sort((a, b) => a.position - b.position));

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ columnId: newColumnId, position: newPosition }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || 'Failed to move task');
      await fetchTasks();
    } catch (err) {
      setTasks((currentTasks) => currentTasks.map((item) => (
        item._id === taskId ? task : item
      )).sort((a, b) => a.position - b.position));
      setError(err.message);
    } finally {
      moveInProgress.current = false;
    }
  };

  const handleTaskDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const draggedTask = tasks.find((task) => task._id === active.id);
    if (!draggedTask) return;

    const overId = String(over.id);
    const targetTask = tasks.find((task) => task._id === overId);
    const targetColumnId = overId.startsWith('column:')
      ? overId.slice('column:'.length)
      : targetTask?.columnId;
    if (!targetColumnId) return;

    const targetTasks = tasks
      .filter((task) => task.columnId === targetColumnId && task._id !== draggedTask._id)
      .sort((a, b) => a.position - b.position);
    let insertIndex = targetTasks.length;

    if (targetTask) {
      insertIndex = targetTasks.findIndex((task) => task._id === targetTask._id);
      if (insertIndex < 0) return;

      if (draggedTask.columnId === targetColumnId) {
        const sourceTasks = tasks
          .filter((task) => task.columnId === targetColumnId)
          .sort((a, b) => a.position - b.position);
        const sourceIndex = sourceTasks.findIndex((task) => task._id === draggedTask._id);
        const overIndex = sourceTasks.findIndex((task) => task._id === targetTask._id);
        if (sourceIndex < overIndex) insertIndex += 1;
      }
    }

    const previousPosition = targetTasks[insertIndex - 1]?.position;
    const nextPosition = targetTasks[insertIndex]?.position;
    const position = previousPosition === undefined
      ? (nextPosition ?? 2000) / 2
      : nextPosition === undefined
        ? previousPosition + 1000
        : (previousPosition + nextPosition) / 2;

    moveTask(draggedTask._id, targetColumnId, position);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-6 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-2 text-center tracking-tight text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-slate-400 text-center mb-6">Apex Flow - Jira Workflow & Trello Agility</p>

          {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg">{error}</div>}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              {isLogin ? 'Sign In' : 'Register Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 hover:underline font-medium ml-1">
              {isLogin ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesPriority = priorityFilter === 'All' || t.priority?.toLowerCase() === priorityFilter.toLowerCase();
    return matchesSearch && matchesPriority;
  });

  const columns = [
    { id: 'todo', title: 'To Do', color: 'border-indigo-500/30 bg-[#0b0f19]/70' },
    { id: 'inprogress', title: 'In Progress', color: 'border-amber-500/30 bg-[#0b0f19]/70' },
    { id: 'done', title: 'Done', color: 'border-emerald-500/30 bg-[#0b0f19]/70' },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Exact Top Header matching design */}
      <header className="border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <img
              src="/Apex%20Flow%20logo%20(1).png"
              alt="Apex Flow"
              width="36"
              height="36"
              className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-indigo-600/20"
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight text-white">Apex Flow</span>
                <span className="px-1.5 py-0.5 text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-md font-bold uppercase tracking-wider">HYBRID</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Jira Workflow & Trello Agility</p>
            </div>
          </div>

          {/* Navigation Toggle Pills */}
          <div className="bg-[#07090e] border border-slate-800/80 p-1 rounded-xl flex space-x-1">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
              <span>Board Workspace</span>
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentView === 'profile' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span>Profile & Admin Center</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#07090e] border border-slate-800/80 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Switch View As:</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-lg uppercase ${user?.role === 'Admin' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
              {user?.role}
            </span>
          </div>

          <div
            onClick={() => setCurrentView('profile')}
            className="flex items-center space-x-3 bg-[#07090e] border border-slate-800/80 hover:border-slate-700 px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
          >
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-200 leading-none">{user?.name || user?.email?.split('@')[0]}</div>
              <div className="text-[10px] text-indigo-400 font-semibold uppercase mt-0.5">{user?.role}</div>
            </div>
          </div>

          <button onClick={logout} className="p-2 bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-900/40 rounded-xl transition-all" title="Logout">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      {currentView === 'dashboard' ? (
        <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full space-y-6">
          {error && <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl">{error}</div>}
          {success && <div className="p-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm rounded-xl">{success}</div>}

          {/* Search, Filter & Create Task Bar */}
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-all w-full md:w-auto"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs w-full md:w-auto justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span>Create Task</span>
            </button>
          </div>

          {/* Kanban Board Columns matching design */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => {
              setActiveTask(tasks.find((task) => task._id === active.id) || null);
            }}
            onDragEnd={(event) => {
              handleTaskDragEnd(event);
              setActiveTask(null);
            }}
            onDragCancel={() => setActiveTask(null)}
          >
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.columnId === col.id);
                return (
                  <DroppableColumn
                    key={col.id}
                    id={col.id}
                    className={`border rounded-2xl p-4 flex flex-col min-h-[600px] ${col.color} backdrop-blur-sm shadow-xl`}
                  >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${col.id === 'todo' ? 'bg-indigo-500' : col.id === 'inprogress' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                      <h3 className="font-bold text-sm text-slate-200">{col.title}</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full font-bold">{colTasks.length}</span>
                  </div>

                  <div className="flex-1 space-y-3.5 overflow-y-auto">
                    <SortableContext items={colTasks.map((task) => task._id)} strategy={verticalListSortingStrategy}>
                      {colTasks.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-slate-600 text-xs italic border border-dashed border-slate-800/60 rounded-xl">
                          No tasks in {col.title}
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <SortableTaskCard key={task._id} task={task}>
                            <>
                          <div className="flex items-start justify-between">
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${task.priority === 'Urgent'
                                  ? 'bg-red-950/80 text-red-400 border border-red-800/50'
                                  : task.priority === 'High'
                                    ? 'bg-orange-950/80 text-orange-400 border border-orange-800/50'
                                    : task.priority === 'Medium'
                                      ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/50'
                                      : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                              {task.priority || 'Medium'}
                            </span>

                            <div className="flex items-center space-x-2">
                              <select
                                value={task.columnId}
                                onChange={(e) => moveTask(task._id, e.target.value)}
                                aria-label={`Move ${task.title} to another column`}
                                className="bg-[#07090e] border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                              >
                                <option value="todo">To Do</option>
                                <option value="inprogress">In Progress</option>
                                <option value="done">Done</option>
                              </select>

                              {(user?.role === 'Admin' || user?.role === 'admin') && (
                                <>
                                <button
                                  onClick={() => openEditTask(task)}
                                  className="text-slate-500 hover:text-indigo-400 p-1 rounded transition-colors"
                                  title="Edit Task"
                                  aria-label={`Edit ${task.title}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m16.862 4.487 2.651 2.651M7.5 16.5l4.25-.85 8.113-8.113a1.875 1.875 0 0 0-2.652-2.652L9.1 13l-.85 3.5Z M5 19h14" /></svg>
                                </button>
                                <button
                                  onClick={() => deleteTask(task._id)}
                                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                                  title="Delete Task"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-100 text-xs leading-snug">{task.title}</h4>
                            {task.description && <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">{task.description}</p>}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
                            <div className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span>{task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'No due date'}</span>
                            </div>

                            <div className="flex items-center space-x-1.5 font-medium text-slate-300">
                              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              <span>{user?.name || 'User'}</span>
                            </div>
                          </div>
                            </>
                          </SortableTaskCard>
                        ))
                      )}
                    </SortableContext>
                  </div>
                  </DroppableColumn>
                );
              })}
            </section>
            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              {activeTask ? (
                <div className="pointer-events-none rotate-[1deg] rounded-xl border border-indigo-400/60 bg-[#0b0f19] p-4 shadow-2xl shadow-indigo-950/50 ring-1 ring-indigo-400/20">
                  <span className="rounded-md border border-indigo-800/50 bg-indigo-950/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    {activeTask.priority || 'Medium'}
                  </span>
                  <h4 className="mt-3 text-xs font-semibold leading-snug text-slate-100">{activeTask.title}</h4>
                  {activeTask.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                      {activeTask.description}
                    </p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {editingTask && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-slate-100">Edit Task</h3>
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close edit task dialog"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={saveTaskChanges} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1" htmlFor="edit-task-title">Task Title</label>
                    <input
                      id="edit-task-title"
                      type="text"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1" htmlFor="edit-task-description">Description</label>
                    <textarea
                      id="edit-task-description"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1" htmlFor="edit-task-priority">Priority</label>
                    <select
                      id="edit-task-priority"
                      value={editPriority}
                      onChange={(event) => setEditPriority(event.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingTask(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Task Modal */}
          {showTaskModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-slate-100">Create New Task</h3>
                  <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={createTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Task Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Implement OAuth"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Description</label>
                    <textarea
                      placeholder="Task details..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Priority</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowTaskModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Dedicated Full-Page Profile & Admin Center View */
        <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Profile & Admin Control Center</h2>
              <p className="text-xs text-slate-400 mt-1">Manage user privilege requests and review full system audit trails</p>
            </div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-4 py-2 bg-[#0b0f19] border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-2"
            >
              <span>← Back to Board</span>
            </button>
          </div>

          {error && <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-lg">{error}</div>}
          {success && <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs rounded-lg">{success}</div>}

          {/* Profile Tabs */}
          <div className="flex space-x-3 border-b border-slate-800 pb-3">
            <button
              onClick={() => setProfileTab('overview')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${profileTab === 'overview' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-[#0b0f19] text-slate-400 hover:text-slate-200'
                }`}
            >
              Overview
            </button>
            {(user?.role === 'Admin' || user?.role === 'admin') && (
              <button
                onClick={() => setProfileTab('approvals')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-2 ${profileTab === 'approvals' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-[#0b0f19] text-slate-400 hover:text-slate-200'
                  }`}
              >
                <span>User Approvals</span>
                {pendingAdmins.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] rounded-full font-bold">{pendingAdmins.length}</span>
                )}
              </button>
            )}
            <button
              onClick={() => setProfileTab('history')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${profileTab === 'history' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-[#0b0f19] text-slate-400 hover:text-slate-200'
                }`}
            >
              Audit Trail History
            </button>
          </div>

          {/* Tab Content */}
          {profileTab === 'overview' && (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center space-x-5">
                <div className="h-16 w-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center font-bold text-2xl text-indigo-300">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{user?.name || user?.email}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Email: <span className="text-slate-200">{user?.email}</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Account Role: <span className="text-indigo-400 font-semibold uppercase">{user?.role}</span></p>
                </div>
              </div>

              {user?.role !== 'Admin' && user?.role !== 'admin' && (
                <div className="pt-5 border-t border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-200 mb-1">Request Admin Access</h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Upgrade your account to an Admin. Existing administrators can approve or reject your request instantly.
                  </p>
                  <button
                    onClick={handleRequestAdmin}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    Apply for Admin Privileges
                  </button>
                </div>
              )}
            </div>
          )}

          {profileTab === 'approvals' && (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-200">Pending Admin Registration Requests</h3>
              {pendingAdmins.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">No pending user admin applications at this moment.</p>
              ) : (
                <div className="space-y-3">
                  {pendingAdmins.map((reqUser) => (
                    <div key={reqUser._id} className="flex items-center justify-between p-4 bg-[#07090e] border border-slate-800 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-slate-200">{reqUser.name}</div>
                        <div className="text-xs text-slate-400">{reqUser.email}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleProcessAdmin(reqUser._id, 'approve')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleProcessAdmin(reqUser._id, 'reject')}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-md"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {profileTab === 'history' && (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex space-x-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setHistoryTab('tasks')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${historyTab === 'tasks' ? 'bg-indigo-600 text-white shadow-md' : 'bg-[#07090e] text-slate-400'
                    }`}
                >
                  Task Activity Log
                </button>
                <button
                  onClick={() => setHistoryTab('security')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${historyTab === 'security' ? 'bg-indigo-600 text-white shadow-md' : 'bg-[#07090e] text-slate-400'
                    }`}
                >
                  Admin & Security Approvals Log
                </button>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {historyTab === 'tasks' ? (
                  auditLogs.taskLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">No task history recorded yet.</p>
                  ) : (
                    auditLogs.taskLogs.map((log) => (
                      <div key={log._id} className="p-3.5 bg-[#07090e] border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span className="font-semibold text-slate-200">{log.performedBy?.name || log.performedBy?.email || 'User'}</span>
                          <span className="text-[10px]">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-300">{log.details}</div>
                      </div>
                    ))
                  )
                ) : auditLogs.securityLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-6 text-center">No security/approval history recorded yet.</p>
                ) : (
                  auditLogs.securityLogs.map((log) => (
                    <div key={log._id} className="p-3.5 bg-[#07090e] border border-slate-800 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span className="font-semibold text-indigo-400">{log.action}</span>
                        <span className="text-[10px]">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-300">{log.details}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}