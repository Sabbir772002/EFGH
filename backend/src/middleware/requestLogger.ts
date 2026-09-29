import { Request, Response, NextFunction } from 'express';

// Simple structured request logger
// Logs: method, path, status code, response time
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '31' : status >= 400 ? '33' : status >= 200 ? '32' : '36';
    console.log(
      `\x1b[${color}m${status}\x1b[0m ${req.method} ${req.originalUrl} — ${ms}ms`
    );
  });

  next();
}
