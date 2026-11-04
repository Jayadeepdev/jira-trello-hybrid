import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['TASK', 'SECURITY'],
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g. "TASK_CREATED", "TASK_MOVED", "TASK_DELETED", "ADMIN_APPROVED", "ADMIN_REJECTED"
    },
    details: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);