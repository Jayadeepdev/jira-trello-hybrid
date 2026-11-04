import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Board } from '../models/Board.js';
import { Workspace } from '../models/Workspace.js';

const ensureUserBoard = async (user) => {
  let workspace = await Workspace.findOne({ owner: user._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: `${user.name}'s Workspace`,
      owner: user._id,
      members: [{ user: user._id, role: user.role }],
    });
  }

  let board = await Board.findOne({ workspaceId: workspace._id });
  if (!board) {
    board = await Board.create({
      title: 'My Board',
      workspaceId: workspace._id,
      columns: [
        { id: 'todo', title: 'To Do', order: 0 },
        { id: 'inprogress', title: 'In Progress', order: 1 },
        { id: 'done', title: 'Done', order: 2 },
      ],
    });
  }

  return board._id.toString();
};

const generateTokenAndSetCookie = (user, res) => {
  const token = jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role }, // Added 'email' here
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || 'Member',
    });

    const boardId = await ensureUserBoard(user);
    const token = generateTokenAndSetCookie(user, res);

    return res.status(201).json({
      success: true,
      token,
      boardId,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const boardId = await ensureUserBoard(user);
    const token = generateTokenAndSetCookie(user, res);

    return res.status(200).json({
      success: true,
      token,
      boardId,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    expires: new Date(0),
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const boardId = await ensureUserBoard(user);
    return res.status(200).json({
      success: true,
      data: { ...user.toObject(), boardId },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};