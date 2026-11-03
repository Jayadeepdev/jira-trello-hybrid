import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
  columnId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  position: { type: Number, required: true } // Floating-point for O(1) reordering
}, { timestamps: true });

// Compound index to optimize column queries and sorting by position
taskSchema.index({ boardId: 1, columnId: 1, position: 1 });

export const Task = mongoose.model('Task', taskSchema);