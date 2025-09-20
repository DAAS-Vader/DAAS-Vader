import { Router, Request, Response } from 'express';
import { getNodeRegistry } from '../services/nodeRegistry.js';
import { ValidationError } from '../types/index.js';

const router = Router();

/**
 * POST /node-registry/register
 * Docker 빌드 노드 등록
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { nodeId, nodeIp, nodePort = 9100, labels = {} } = req.body;

    if (!nodeId || typeof nodeId !== 'string') {
      throw new ValidationError('Node ID is required');
    }

    if (!nodeIp || typeof nodeIp !== 'string') {
      throw new ValidationError('Node IP is required');
    }

    const registry = getNodeRegistry();
    await registry.registerNode(nodeId, nodeIp, nodePort, labels);

    res.status(200).json({
      success: true,
      message: 'Node registered successfully',
      node: {
        id: nodeId,
        address: `${nodeIp}:${nodePort}`,
        labels
      }
    });

  } catch (error) {
    console.error('Node registration error:', error);

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
      error: 'Registration Failed',
      message: 'Failed to register node'
    });
  }
});

/**
 * DELETE /node-registry/unregister/:nodeId
 * Docker 빌드 노드 등록 해제
 */
router.delete('/unregister/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;

    const registry = getNodeRegistry();
    await registry.unregisterNode(nodeId);

    res.status(200).json({
      success: true,
      message: 'Node unregistered successfully',
      nodeId
    });

  } catch (error) {
    console.error('Node unregistration error:', error);
    res.status(500).json({
      success: false,
      error: 'Unregistration Failed',
      message: 'Failed to unregister node'
    });
  }
});

/**
 * GET /node-registry/list
 * 등록된 모든 노드 조회
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const registry = getNodeRegistry();
    const nodes = await registry.listNodes();

    res.status(200).json({
      success: true,
      nodes,
      count: nodes.length
    });

  } catch (error) {
    console.error('Node listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Listing Failed',
      message: 'Failed to list nodes'
    });
  }
});

/**
 * GET /node-registry/health
 * 모든 노드의 헬스 상태 확인
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const registry = getNodeRegistry();
    const healthMap = await registry.checkAllNodesHealth();

    const healthStatus = Array.from(healthMap.entries()).map(([nodeId, isHealthy]) => ({
      nodeId,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    }));

    const healthyCount = healthStatus.filter(s => s.status === 'healthy').length;
    const totalCount = healthStatus.length;

    res.status(200).json({
      success: true,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount
      },
      nodes: healthStatus
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health Check Failed',
      message: 'Failed to check nodes health'
    });
  }
});

/**
 * GET /node-registry/health/:nodeId
 * 특정 노드의 헬스 상태 확인
 */
router.get('/health/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const registry = getNodeRegistry();

    const nodes = await registry.listNodes();
    const node = nodes.find(n => n.labels.node === nodeId);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node Not Found',
        message: `Node ${nodeId} is not registered`
      });
      return;
    }

    const [ip, port] = node.targets[0].split(':');
    const isHealthy = await registry.checkNodeHealth(ip, parseInt(port));

    res.status(200).json({
      success: true,
      nodeId,
      address: node.targets[0],
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Node health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health Check Failed',
      message: 'Failed to check node health'
    });
  }
});

/**
 * POST /node-registry/setup-prometheus
 * Prometheus 설정 업데이트 (파일 기반 서비스 디스커버리 활성화)
 */
router.post('/setup-prometheus', async (req: Request, res: Response) => {
  try {
    const registry = getNodeRegistry();
    await registry.initializeTargetsDirectory();
    await registry.updatePrometheusConfig();

    res.status(200).json({
      success: true,
      message: 'Prometheus configuration updated for dynamic node discovery',
      targetsDirectory: 'targets/',
      configFile: 'prometheus.yml'
    });

  } catch (error) {
    console.error('Prometheus setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Setup Failed',
      message: 'Failed to setup Prometheus configuration'
    });
  }
});

export default router;