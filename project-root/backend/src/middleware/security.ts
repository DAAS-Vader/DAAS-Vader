import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from '../services/logger.js';

// Rate limiting 설정
export const createRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method
      });

      res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests from this IP address',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// API 일반 요청 제한
export const generalRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15분
  parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'), // 기본 100 요청
  'Too many API requests'
);

// 인증 관련 요청 제한 (더 엄격)
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15분
  5, // 5번 시도
  'Too many authentication attempts'
);

// 업로드 요청 제한
export const uploadRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1시간
  10, // 10번 업로드
  'Too many upload requests'
);

// 느린 응답 (DDoS 방지)
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15분
  delayAfter: 50, // 50번 요청 후 지연 시작
  delayMs: () => 500, // 500ms 고정 지연
  maxDelayMs: 20000, // 최대 20초 지연
  validate: { delayMs: false } // 경고 메시지 비활성화
});

// 보안 헤더 미들웨어
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // XSS 보호
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Type Sniffing 방지
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Frame 옵션 (Clickjacking 방지)
  res.setHeader('X-Frame-Options', 'DENY');

  // HSTS (HTTPS 강제)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://fullnode.testnet.sui.io https://fullnode.mainnet.sui.io; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  next();
};

// IP 화이트리스트 미들웨어
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || '';

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.security('IP blocked', {
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method,
        allowedIPs
      });

      res.status(403).json({
        success: false,
        error: 'Access Denied',
        message: 'Your IP address is not allowed to access this resource'
      });
      return;
    }

    next();
  };
};

// 요청 크기 제한 미들웨어
export const requestSizeLimit = (maxSize: string) => {
  const sizeInBytes = parseSize(maxSize);

  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > sizeInBytes) {
      logger.security('Request size exceeded', {
        ipAddress: req.ip,
        contentLength,
        maxSize: sizeInBytes,
        url: req.url,
        method: req.method
      });

      res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        message: `Request size exceeds maximum allowed size of ${maxSize}`
      });
      return;
    }

    next();
  };
};

// CORS 보안 설정
export const corsSecurityOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // 프로덕션 환경에서는 허용된 도메인만 접근 가능
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.security('CORS violation', {
          origin,
          allowedOrigins
        });
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // 개발 환경에서는 모든 origin 허용
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'x-wallet-address'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24시간
};

// 입력 검증 및 sanitization
export const inputSanitization = (req: Request, res: Response, next: NextFunction) => {
  // SQL Injection 패턴 검사
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i;

  // XSS 패턴 검사
  const xssPattern = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

  const checkValue = (value: any, path: string = ''): boolean => {
    if (typeof value === 'string') {
      if (sqlInjectionPattern.test(value) || xssPattern.test(value)) {
        logger.security('Malicious input detected', {
          ipAddress: req.ip,
          path,
          value: value.substring(0, 100), // 처음 100자만 로그
          pattern: sqlInjectionPattern.test(value) ? 'SQL_INJECTION' : 'XSS'
        });
        return false;
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (!checkValue(val, `${path}.${key}`)) {
          return false;
        }
      }
    }
    return true;
  };

  // 요청 body 검사
  if (req.body && !checkValue(req.body, 'body')) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Malicious input detected'
    });
    return;
  }

  // 쿼리 파라미터 검사
  if (req.query && !checkValue(req.query, 'query')) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Malicious input detected'
    });
    return;
  }

  next();
};

// API 키 검증 미들웨어
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required'
    });
    return;
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.security('Invalid API key', {
      ipAddress: req.ip,
      apiKey: apiKey.substring(0, 10) + '***', // 앞 10자만 로그
      url: req.url
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
    return;
  }

  next();
};

// 프로덕션 환경 검증
export const productionCheck = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    // 프로덕션에서 비활성화되어야 할 기능들
    const devOnlyPaths = ['/api/debug', '/api/test'];

    if (devOnlyPaths.some(path => req.path.startsWith(path))) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'This endpoint is not available in production'
      });
      return;
    }

    // 개발용 토큰 비활성화
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.includes('dev-allow')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Development tokens are not allowed in production'
      });
      return;
    }
  }

  next();
};

// 유틸리티 함수
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };

  const match = size.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  if (!(unit in units)) {
    throw new Error(`Unknown size unit: ${unit}`);
  }

  return Math.floor(value * units[unit]);
}