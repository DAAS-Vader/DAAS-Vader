import { Request, Response, NextFunction } from 'express';
import { ValidationError, ServiceError } from '../types/index.js';

// Helper function to safely check error codes
function hasErrorCode(error: any): error is Error & { code: string } {
  return error && typeof error.code === 'string';
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
    method: req.method
  });
}

export function errorHandler(
  error: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query
  });

  // Validation errors
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
    return;
  }

  // Service errors (with custom status codes)
  if (error instanceof ServiceError) {
    res.status(error.statusCode).json({
      error: 'Service Error',
      message: error.message
    });
    return;
  }

  // Multer file upload errors
  if (hasErrorCode(error) && error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'File Too Large',
      message: 'Uploaded file exceeds size limit'
    });
    return;
  }

  if (hasErrorCode(error) && error.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({
      error: 'Invalid File Field',
      message: 'Unexpected file field in upload'
    });
    return;
  }

  // Database errors
  if (hasErrorCode(error) && error.code === '23505') { // PostgreSQL unique violation
    res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    });
    return;
  }

  if (hasErrorCode(error) && error.code === '23503') { // PostgreSQL foreign key violation
    res.status(400).json({
      error: 'Invalid Reference',
      message: 'Referenced resource does not exist'
    });
    return;
  }

  // Network/timeout errors
  if (hasErrorCode(error) && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
    res.status(502).json({
      error: 'Service Unavailable',
      message: 'External service connection failed'
    });
    return;
  }

  if (hasErrorCode(error) && error.code === 'ETIMEDOUT') {
    res.status(504).json({
      error: 'Gateway Timeout',
      message: 'External service request timed out'
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { 
      details: error.message,
      stack: error.stack 
    })
  });
}