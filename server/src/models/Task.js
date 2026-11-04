import mongoose from 'mongoose';

const activityChangeSchema = new mongoose.Schema({
  field: { type: String, required: true },
  from: { type: String, default: '' },
  to: { type: String, default: '' },
}, { _id: false });

const taskActivitySchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: [activityChangeSchema], default: [] },
  timestamp: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
  columnId: { type: String, required: true, default: 'todo' },
  position: { type: Number, default: 1000 },
  dueDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activityLog: { type: [taskActivitySchema], default: [] },
  history: [
    {
      action: String,
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

taskSchema.pre('save', async function logAdminContentChanges() {
  const contentFields = ['title', 'description', 'priority'];
  if (this.isNew || !contentFields.some((field) => this.isModified(field))) return;

  const latestHistoryEntry = this.history.at(-1);
  if (!latestHistoryEntry?.performedBy || !/\(Role:\s*Admin\)/i.test(latestHistoryEntry.action || '')) {
    return;
  }

  const previousTask = await this.constructor.findById(this._id)
    .select('title description priority')
    .lean();
  if (!previousTask) return;

  const changes = contentFields
    .filter((field) => this.get(field) !== previousTask[field])
    .map((field) => ({
      field,
      from: previousTask[field] ?? '',
      to: this.get(field) ?? '',
    }));

  if (changes.length) {
    this.activityLog.push({
      action: 'TASK_UPDATED',
      performedBy: latestHistoryEntry.performedBy,
      changes,
    });
  }
});

const Task = mongoose.model('Task', taskSchema);

export default Task;