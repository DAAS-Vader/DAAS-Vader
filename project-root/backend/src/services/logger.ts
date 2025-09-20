import winston from 'winston';
import path from 'path';

// 로그 레벨 정의
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

// 로그 컨텍스트 인터페이스
export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  operation?: string;
  resource?: string;
  duration?: number;
  [key: string]: any;
}

// 구조화된 로그 인터페이스
export interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// 로깅 설정
interface LoggerConfig {
  level: string;
  format: 'json' | 'pretty';
  service: string;
  environment: string;
  logDir: string;
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: string;
  maxFiles: string;
}

class Logger {
  private winston: winston.Logger;
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: process.env.LOG_LEVEL || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'pretty') || 'pretty',
      service: 'daas-vader-backend',
      environment: process.env.NODE_ENV || 'development',
      logDir: path.join(process.cwd(), 'logs'),
      enableConsole: true,
      enableFile: process.env.NODE_ENV === 'production',
      maxFileSize: '20m',
      maxFiles: '14d',
      ...config
    };

    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: this.config.format === 'json'
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }: any) => {
                  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                  return `${timestamp} [${level}]: ${message} ${metaStr}`;
                })
              )
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      // Combined logs
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'combined.log'),
          format: winston.format.json(),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024, // Convert MB to bytes
          maxFiles: parseInt(this.config.maxFiles),
          tailable: true
        })
      );

      // Error logs
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'error.log'),
          level: 'error',
          format: winston.format.json(),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles),
          tailable: true
        })
      );

      // HTTP access logs
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'access.log'),
          level: 'http',
          format: winston.format.json(),
          maxsize: parseInt(this.config.maxFileSize) * 1024 * 1024,
          maxFiles: parseInt(this.config.maxFiles),
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: this.config.service,
        environment: this.config.environment
      },
      transports,
      // 예외 처리
      exceptionHandlers: this.config.enableFile ? [
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'exceptions.log'),
          format: winston.format.json()
        })
      ] : [],
      rejectionHandlers: this.config.enableFile ? [
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'rejections.log'),
          format: winston.format.json()
        })
      ] : []
    });
  }

  // 기본 로깅 메서드들
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  http(message: string, context?: LogContext): void {
    this.log(LogLevel.HTTP, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // 구조화된 로깅 메서드
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logEntry: StructuredLog = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      environment: this.config.environment,
      context
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    this.winston.log(level, logEntry);
  }

  // 특별한 로깅 메서드들
  security(event: string, context: LogContext, details?: any): void {
    this.info(`SECURITY: ${event}`, {
      ...context,
      securityEvent: true,
      details
    });
  }

  audit(action: string, context: LogContext, result: 'success' | 'failure', details?: any): void {
    this.info(`AUDIT: ${action}`, {
      ...context,
      auditEvent: true,
      result,
      details
    });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`PERFORMANCE: ${operation}`, {
      ...context,
      performanceEvent: true,
      duration,
      slow: duration > 1000 // 1초 이상이면 slow로 표시
    });
  }

  business(event: string, context: LogContext, metrics?: Record<string, number>): void {
    this.info(`BUSINESS: ${event}`, {
      ...context,
      businessEvent: true,
      metrics
    });
  }

  // 헬퍼 메서드들
  child(baseContext: LogContext): Logger {
    const childLogger = new Logger(this.config);
    const originalLog = (childLogger as any).log.bind(childLogger);

    (childLogger as any).log = (level: LogLevel, message: string, context?: LogContext, error?: Error) => {
      const mergedContext = { ...baseContext, ...context };
      return originalLog(level, message, mergedContext, error);
    };

    return childLogger;
  }

  // 메트릭 수집을 위한 로그 쿼리
  async getLogMetrics(timeRange: number = 3600000): Promise<LogMetrics> {
    // 실제 구현에서는 로그 파일이나 로그 데이터베이스에서 메트릭을 추출
    const now = Date.now();
    const startTime = now - timeRange;

    return {
      timeRange: { start: startTime, end: now },
      totalLogs: 0, // 실제 구현 필요
      errorCount: 0,
      warningCount: 0,
      httpRequests: 0,
      averageResponseTime: 0,
      slowQueries: 0,
      securityEvents: 0,
      auditEvents: 0
    };
  }
}

// 로그 메트릭 인터페이스
export interface LogMetrics {
  timeRange: { start: number; end: number };
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  httpRequests: number;
  averageResponseTime: number;
  slowQueries: number;
  securityEvents: number;
  auditEvents: number;
}

// 싱글톤 로거 인스턴스
export const logger = new Logger();

// Express 미들웨어용 로거
export const createRequestLogger = (baseContext?: LogContext) => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 요청 시작 로그
    logger.http('Request started', {
      ...baseContext,
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // 응답 완료 시 로그
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 400 ? LogLevel.WARN : LogLevel.HTTP;

      (logger as any).log(level, 'Request completed', {
        ...baseContext,
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length')
      });
    });

    next();
  };
};

export default Logger;