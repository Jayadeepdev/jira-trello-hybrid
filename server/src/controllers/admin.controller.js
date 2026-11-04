import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

// Get all pending Admin approval requests (Admin only)
export const getPendingAdminRequests = async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const pendingUsers = await User.find({ adminRequested: true, status: 'Pending' })
      .select('-password');

    return res.status(200).json({ success: true, data: pendingUsers });
  } catch (error) {
    next(error);
  }
};

// Process Admin Request (Approve or Reject)
export const processAdminRequest = async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    const { userId, action } = req.body; // action: 'approve' | 'reject'
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (action === 'approve') {
      targetUser.role = 'Admin';
      targetUser.status = 'Approved';
      targetUser.adminRequested = false;
      await targetUser.save();

      await AuditLog.create({
        type: 'SECURITY',
        action: 'ADMIN_APPROVED',
        details: `Approved ${targetUser.name} (${targetUser.email}) as Admin.`,
        performedBy: req.user.id,
        targetUser: targetUser._id,
      });

      return res.status(200).json({ success: true, message: `${targetUser.name} is now an Admin.` });
    } else if (action === 'reject') {
      targetUser.status = 'Approved'; // Remains standard member
      targetUser.adminRequested = false;
      await targetUser.save();

      await AuditLog.create({
        type: 'SECURITY',
        action: 'ADMIN_REJECTED',
        details: `Rejected Admin request for ${targetUser.name} (${targetUser.email}).`,
        performedBy: req.user.id,
        targetUser: targetUser._id,
      });

      return res.status(200).json({ success: true, message: `Admin request for ${targetUser.name} was rejected.` });
    }

    return res.status(400).json({ success: false, message: 'Invalid action.' });
  } catch (error) {
    next(error);
  }
};

// Request Admin role (Self-service for Members)
export const requestAdminRole = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.adminRequested = true;
    user.status = 'Pending';
    await user.save();

    await AuditLog.create({
      type: 'SECURITY',
      action: 'ADMIN_REQUESTED',
      details: `${user.name} (${user.email}) requested Admin privileges.`,
      performedBy: req.user.id,
    });

    return res.status(200).json({ success: true, message: 'Admin request submitted for approval.' });
  } catch (error) {
    next(error);
  }
};

// Get Split Audit History Logs
export const getAuditLogs = async (req, res, next) => {
  try {
    const taskLogs = await AuditLog.find({ type: 'TASK' })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    const securityLogs = await AuditLog.find({ type: 'SECURITY' })
      .populate('performedBy', 'name email')
      .populate('targetUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: {
        taskLogs,
        securityLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};