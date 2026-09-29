import { Request, Response, NextFunction } from 'express';

// Central error handler — catches anything thrown in route handlers
// Must be registered LAST in Express (after all routes)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      // Unique constraint violation
      const field = prismaErr.meta?.target?.[0] ?? 'field';
      res.status(409).json({ error: `${field} already exists` });
      return;
    }
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
