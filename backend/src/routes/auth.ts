import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../config';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^01[3-9]\d{8}$/, 'Must be a valid Bangladeshi phone number (e.g. 01711000001)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['passenger', 'driver']).default('passenger'),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Phone number already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        passwordHash: hashedPassword,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        walletPaisa: true,
        isOnline: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        walletPaisa: user.walletPaisa,
        isOnline: user.isOnline,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        walletPaisa: true,
        isOnline: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(444).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
