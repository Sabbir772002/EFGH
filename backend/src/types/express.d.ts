import { Request } from 'express';

// Augment Express Request so req.user is available after JWT middleware
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        phone: string;
        role: 'passenger' | 'driver';
        isOnline: boolean;
      };
    }
  }
}

export {};
