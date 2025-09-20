import { Router, Request, Response } from 'express';
import { getPrometheusService } from '../services/prometheusService.js';
import { ValidationError } from '../types/index.js';

const router = Router();

/**
 * GET /metrics
 * Prometheus 메트릭 엔드포인트 (표준)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();
    const metrics = await prometheus.getMetrics();

    // Prometheus 표준 Content-Type 설정
    res.set('Content-Type', prometheus.getRegister().contentType);
    res.status(200).send(metrics);

  } catch (error) {
    console.error('Prometheus metrics error:', error);
    res.status(500).send('# Error retrieving metrics\n');
  }
});

/**
 * GET /prometheus/health
 * Prometheus 서비스 상태 확인
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();

    // 간단한 헬스체크 메트릭 확인
    const register = prometheus.getRegister();
    const metricNames = await register.getMetricsAsJSON();

    res.status(200).json({
      status: 'healthy',
      service: 'prometheus',
      metrics_count: metricNames.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Prometheus health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'prometheus',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /prometheus/metrics/record
 * 커스텀 메트릭 수동 기록 (개발/테스트용)
 */
router.post('/metrics/record', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();
    const { type, operation, success, nodeId, duration, method, route, statusCode } = req.body;

    if (!type || typeof type !== 'string') {
      throw new ValidationError('Metric type is required');
    }

    switch (type.toLowerCase()) {
      case 'http':
        if (!method || !route || !statusCode || duration === undefined) {
          throw new ValidationError('HTTP metrics require: method, route, statusCode, duration');
        }
        prometheus.recordHttpRequest(method, route, statusCode, duration);
        break;

      case 'key':
        if (!operation || success === undefined) {
          throw new ValidationError('Key metrics require: operation, success');
        }
        prometheus.recordKeyOperation(operation, success);
        break;

      case 'seal':
        if (!operation || success === undefined) {
          throw new ValidationError('Seal metrics require: operation, success');
        }
        prometheus.recordSealOperation(operation, success);
        break;

      case 'docker':
        if (!nodeId || success === undefined) {
          throw new ValidationError('Docker metrics require: nodeId, success');
        }
        prometheus.recordDockerBuild(nodeId, success);
        break;

      default:
        throw new ValidationError(`Unsupported metric type: ${type}`);
    }

    res.status(200).json({
      success: true,
      message: `${type} metric recorded successfully`,
      type,
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
      message: 'Failed to record custom metric'
    });
  }
});

/**
 * PUT /prometheus/node/:nodeId/health
 * 노드 상태 업데이트
 */
router.put('/node/:nodeId/health', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();
    const { nodeId } = req.params;
    const { service, status } = req.body;

    if (!service || typeof service !== 'string') {
      throw new ValidationError('Service name is required');
    }

    if (!status || !['healthy', 'degraded', 'unhealthy'].includes(status)) {
      throw new ValidationError('Status must be one of: healthy, degraded, unhealthy');
    }

    prometheus.updateNodeHealth(nodeId, service, status);

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
 * PUT /prometheus/connections
 * 활성 연결 수 업데이트
 */
router.put('/connections', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();
    const { type, count } = req.body;

    if (!type || typeof type !== 'string') {
      throw new ValidationError('Connection type is required');
    }

    if (count === undefined || typeof count !== 'number' || count < 0) {
      throw new ValidationError('Count must be a non-negative number');
    }

    prometheus.updateActiveConnections(type, count);

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

/**
 * PUT /prometheus/error-rate
 * 에러율 업데이트
 */
router.put('/error-rate', async (req: Request, res: Response) => {
  try {
    const prometheus = getPrometheusService();
    const { service, timeWindow, rate } = req.body;

    if (!service || typeof service !== 'string') {
      throw new ValidationError('Service name is required');
    }

    if (!timeWindow || typeof timeWindow !== 'string') {
      throw new ValidationError('Time window is required (e.g., "1m", "5m", "15m")');
    }

    if (rate === undefined || typeof rate !== 'number' || rate < 0 || rate > 1) {
      throw new ValidationError('Rate must be a number between 0 and 1');
    }

    prometheus.updateErrorRate(service, timeWindow, rate);

    res.status(200).json({
      success: true,
      message: 'Error rate updated successfully',
      service,
      timeWindow,
      rate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error rate update error:', error);

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
      error: 'Error Rate Update Failed',
      message: 'Failed to update error rate'
    });
  }
});

/**
 * GET /prometheus/targets
 * 모니터링 대상 정보 조회 (Prometheus 설정 참고용)
 */
router.get('/targets', async (req: Request, res: Response) => {
  try {
    const targets = [
      {
        job: 'daas-vader-backend',
        target: `${req.protocol}://${req.get('host')}/metrics`,
        labels: {
          instance: process.env.NODE_ENV || 'development',
          service: 'daas-vader',
          version: process.env.npm_package_version || '1.0.0'
        },
        health: 'up',
        lastScrape: new Date().toISOString(),
        scrapeInterval: '30s'
      }
    ];

    res.status(200).json({
      success: true,
      targets,
      count: targets.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Targets info error:', error);
    res.status(500).json({
      success: false,
      error: 'Targets Info Failed',
      message: 'Failed to retrieve targets information'
    });
  }
});

/**
 * GET /prometheus/config
 * Prometheus 클라이언트 설정 정보
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = {
      service: 'daas-vader-backend',
      version: '1.0.0',
      metricsEndpoint: '/metrics',
      collectionInterval: '30s',
      retentionPolicy: 'memory-only',
      supportedMetricTypes: [
        'counter',
        'gauge',
        'histogram',
        'summary'
      ],
      customMetrics: [
        'daas_vader_cpu_usage_percent',
        'daas_vader_memory_usage_bytes',
        'daas_vader_disk_usage_bytes',
        'daas_vader_network_io_bytes',
        'daas_vader_http_requests_total',
        'daas_vader_key_operations_total',
        'daas_vader_seal_operations_total',
        'daas_vader_docker_builds_total',
        'daas_vader_node_health_status',
        'daas_vader_errors_total'
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
      message: 'Failed to retrieve configuration information'
    });
  }
});

/**
 * POST /prometheus/reset
 * 메트릭 초기화 (개발/테스트용)
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'Reset Not Allowed',
        message: 'Metrics reset is not allowed in production'
      });
      return;
    }

    const prometheus = getPrometheusService();
    prometheus.clearMetrics();

    res.status(200).json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metrics reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Reset Failed',
      message: 'Failed to reset metrics'
    });
  }
});

export default router;