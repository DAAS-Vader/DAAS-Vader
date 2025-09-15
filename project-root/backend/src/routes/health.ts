import { Router, Request, Response } from 'express';
import { pool } from '../db/connection.js';

const router = Router();

/**
 * 헬스체크 엔드포인트
 */
router.get('/', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: false
    }
  };

  try {
    // PostgreSQL 연결 확인
    const dbClient = await pool.connect();
    await dbClient.query('SELECT 1');
    dbClient.release();
    health.services.database = true;
    health.status = 'ok';
  } catch (error) {
    console.error('Database health check failed:', error);
    health.status = 'degraded';
  }

  // 해커톤용으로 데이터베이스 상태만 반환
  const statusCode = health.services.database ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * 상세 헬스체크 엔드포인트
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const detailed = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: { status: false, details: null as any }
    }
  };

  // 데이터베이스 상세 정보
  try {
    const dbClient = await pool.connect();
    const result = await dbClient.query('SELECT version(), now() as current_time');
    dbClient.release();
    
    detailed.services.database = {
      status: true,
      details: {
        version: result.rows[0].version,
        current_time: result.rows[0].current_time,
        pool_stats: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      }
    };
  } catch (error) {
    detailed.services.database = {
      status: false,
      details: { error: (error as Error).message }
    };
  }


  // 외부 서비스는 해커톤용으로 비활성화

  // 전체 상태 - 해커톤용으로 데이터베이스만 확인
  const databaseHealthy = detailed.services.database.status;
  detailed.status = databaseHealthy ? 'ok' : 'degraded';

  const statusCode = databaseHealthy ? 200 : 503;
  res.status(statusCode).json(detailed);
});

export default router;