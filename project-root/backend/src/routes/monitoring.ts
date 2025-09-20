import { Router, Request, Response } from 'express';
import { getPrometheusService } from '../services/prometheusService.js';
import { ValidationError } from '../types/index.js';
import * as os from 'os';

// Helper functions moved from monitoring service
async function checkSystemHealth() {
  const timestamp = Date.now();
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  const services = {
    prometheus: true,
    keyServer: true,
    sealService: true,
    suiNetwork: true
  };

  const allHealthy = Object.values(services).every(status => status === true);
  const status = allHealthy ? 'healthy' : 'unhealthy';

  // Update Prometheus metrics
  const prometheus = getPrometheusService();
  prometheus.updateNodeHealth('main', 'system', status);

  return { status, timestamp, uptime, memory, services };
}

function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptime: process.uptime(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem()
  };
}

const router = Router();

// ==================== 대시보드 및 상태 ====================

/**
 * GET /monitoring/dashboard
 * 대시보드 데이터 조회 (Prometheus 기반)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    // Dashboard data inline
    const health = await checkSystemHealth();
    const systemInfo = getSystemInfo();
    const dashboardData = { health, systemInfo, metricsEndpoint: '/metrics' };

    res.status(200).json({
      success: true,
      dashboard: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Dashboard Data Failed',
      message: 'Failed to retrieve dashboard data'
    });
  }
});

/**
 * GET /monitoring/health
 * 현재 시스템 상태 조회 (간단한 헬스 체크)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const health = await checkSystemHealth();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      checks: {
        server: true,
        uptime: health.uptime,
        memory: health.memory,
        services: health.services
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health Check Failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /monitoring/health/detailed
 * 상세한 시스템 상태 조회
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const health = await checkSystemHealth();
    const systemInfo = getSystemInfo();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      health: {
        ...health,
        systemInfo
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Detailed Health Check Failed',
      message: 'Failed to check system health'
    });
  }
});

/**
 * GET /monitoring/readiness
 * Kubernetes 스타일 readiness 체크
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const monitoring = getPrometheusService();
    const health = await checkSystemHealth();

    const responseTime = Date.now() - startTime;
    const allReady = health.status !== 'unhealthy';

    res.status(allReady ? 200 : 503).json({
      ready: allReady,
      checks: health.services,
      responseTime: responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Readiness check error:', error);
    res.status(503).json({
      ready: false,
      error: 'Readiness Check Failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /monitoring/liveness
 * Kubernetes 스타일 liveness 체크
 */
router.get('/liveness', (req: Request, res: Response) => {
  try {
    // 애플리케이션이 살아있는지만 체크 (매우 빠름)
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      alive: false,
      error: 'Liveness Check Failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 메트릭 관리 ====================

/**
 * GET /monitoring/metrics
 * Prometheus 메트릭 조회
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const metrics = await monitoring.getMetrics();

    // Prometheus 형식으로 응답
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);

  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).send('# Error retrieving metrics\n');
  }
});

/**
 * POST /monitoring/metrics/record
 * 커스텀 메트릭 수동 기록
 */
router.post('/metrics/record', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const { operation, type, success, duration, nodeId } = req.body;

    if (!operation || typeof operation !== 'string') {
      throw new ValidationError('Operation name is required');
    }

    if (!type || typeof type !== 'string') {
      throw new ValidationError('Metric type is required (key, seal, docker, sui)');
    }

    if (success === undefined || typeof success !== 'boolean') {
      throw new ValidationError('Success status is required');
    }

    switch (type.toLowerCase()) {
      case 'key':
        monitoring.recordKeyOperation(operation, success);
        break;

      case 'seal':
        monitoring.recordSealOperation(operation, success);
        break;

      case 'docker':
        if (!nodeId) {
          throw new ValidationError('nodeId is required for docker metrics');
        }
        monitoring.recordDockerBuild(nodeId, success);
        break;

      case 'sui':
        monitoring.recordKeyOperation('sui_transaction', success);
        break;

      default:
        throw new ValidationError(`Unsupported metric type: ${type}`);
    }

    res.status(200).json({
      success: true,
      message: `${type} metric recorded successfully`,
      operation,
      type,
      result: success ? 'success' : 'error',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metric recording error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Metric Recording Failed',
      message: 'Failed to record metric'
    });
  }
});

// ==================== 노드 상태 관리 ====================

/**
 * PUT /monitoring/node/:nodeId/health
 * 노드 상태 업데이트
 */
router.put('/node/:nodeId/health', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const { nodeId } = req.params;
    const { service, status } = req.body;

    if (!service || typeof service !== 'string') {
      throw new ValidationError('Service name is required');
    }

    if (!status || !['healthy', 'degraded', 'unhealthy'].includes(status)) {
      throw new ValidationError('Status must be one of: healthy, degraded, unhealthy');
    }

    monitoring.updateNodeHealth(nodeId, service, status);

    res.status(200).json({
      success: true,
      message: 'Node health updated successfully',
      nodeId,
      service,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Node health update error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Node Health Update Failed',
      message: 'Failed to update node health status'
    });
  }
});

/**
 * PUT /monitoring/connections
 * 활성 연결 수 업데이트
 */
router.put('/connections', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const { type, count } = req.body;

    if (!type || typeof type !== 'string') {
      throw new ValidationError('Connection type is required');
    }

    if (count === undefined || typeof count !== 'number' || count < 0) {
      throw new ValidationError('Count must be a non-negative number');
    }

    monitoring.updateActiveConnections(type, count);

    res.status(200).json({
      success: true,
      message: 'Active connections updated successfully',
      type,
      count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Connections update error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Connections Update Failed',
      message: 'Failed to update active connections'
    });
  }
});

// ==================== 시스템 정보 ====================

/**
 * GET /monitoring/system/info
 * 시스템 정보 조회
 */
router.get('/system/info', async (req: Request, res: Response) => {
  try {
    const monitoring = getPrometheusService();
    const systemInfo = getSystemInfo();

    res.status(200).json({
      success: true,
      system: systemInfo
    });

  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({
      success: false,
      error: 'System Info Failed',
      message: 'Failed to retrieve system information'
    });
  }
});

/**
 * GET /monitoring/prometheus/config
 * Prometheus 설정 정보
 */
router.get('/prometheus/config', async (req: Request, res: Response) => {
  try {
    const config = {
      service: 'daas-vader-backend',
      version: '1.0.0',
      metricsEndpoint: '/monitoring/metrics',
      collectionInterval: '30s',
      supportedMetrics: [
        'daas_vader_cpu_usage_percent',
        'daas_vader_memory_usage_bytes',
        'daas_vader_disk_usage_bytes',
        'daas_vader_network_io_bytes',
        'daas_vader_http_requests_total',
        'daas_vader_key_operations_total',
        'daas_vader_seal_operations_total',
        'daas_vader_docker_builds_total',
        'daas_vader_node_health_status'
      ],
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Config info error:', error);
    res.status(500).json({
      success: false,
      error: 'Config Info Failed',
      message: 'Failed to retrieve Prometheus configuration'
    });
  }
});

export default router;