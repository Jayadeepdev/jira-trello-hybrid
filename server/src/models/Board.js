import mongoose from 'mongoose';

const columnSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  order: { type: Number, required: true }
});

const boardSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  columns: [columnSchema]
}, { timestamps: true });

export const Board = mongoose.model('Board', boardSchema);