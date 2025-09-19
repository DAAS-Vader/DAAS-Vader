import express, { Request, Response } from 'express';
import { DockerBuilderService } from '../../../src/services/dockerBuilderService.js';

const router = express.Router();

// Helper to get docker builder service from app locals
const getDockerBuilder = (req: Request): DockerBuilderService => {
  return req.app.locals.dockerBuilder;
};

/**
 * POST /api/docker/build
 * Build Docker image from code bundle
 */
router.post('/build', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const { bundleId, buildOptions, registry } = req.body;

    // Validate required fields
    if (!bundleId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'bundleId is required'
      });
    }

    // Validate bundleId format (should be Walrus blob ID)
    if (typeof bundleId !== 'string' || bundleId.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid bundleId format'
      });
    }

    console.log(`🔨 Starting Docker build for bundle: ${bundleId}`);

    // Start the build
    const buildId = await dockerBuilder.startBuild({
      bundleId,
      buildOptions,
      registry
    });

    res.status(202).json({
      success: true,
      buildId,
      message: 'Build started successfully',
      statusUrl: `/api/docker/build/${buildId}`
    });

  } catch (error) {
    console.error('Docker build endpoint error:', error);

    if ((error as any).statusCode) {
      res.status((error as any).statusCode).json({
        success: false,
        error: 'Service Error',
        message: (error as Error).message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during build initiation'
      });
    }
  }
});

/**
 * GET /api/docker/build/:buildId
 * Get build status and logs
 */
router.get('/build/:buildId', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const { buildId } = req.params;

    if (!buildId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'buildId is required'
      });
    }

    const buildStatus = dockerBuilder.getBuildStatus(buildId);

    if (!buildStatus) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Build not found'
      });
    }

    res.json({
      success: true,
      data: buildStatus
    });

  } catch (error) {
    console.error('Docker build status endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching build status'
    });
  }
});

/**
 * DELETE /api/docker/build/:buildId
 * Cancel an active build
 */
router.delete('/build/:buildId', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const { buildId } = req.params;

    if (!buildId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'buildId is required'
      });
    }

    const cancelled = await dockerBuilder.cancelBuild(buildId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Build not found or already completed'
      });
    }

    res.json({
      success: true,
      message: 'Build cancelled successfully'
    });

  } catch (error) {
    console.error('Docker build cancel endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while cancelling build'
    });
  }
});

/**
 * POST /api/docker/push
 * Push built image to registry
 */
router.post('/push', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const { buildId, registry } = req.body;

    // Validate required fields
    if (!buildId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'buildId is required'
      });
    }

    if (!registry || !registry.url || !registry.username || !registry.password) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Registry configuration with url, username, and password is required'
      });
    }

    console.log(`📤 Pushing image for build: ${buildId}`);

    // Push the image
    const registryTag = await dockerBuilder.pushImage(buildId, registry);

    res.json({
      success: true,
      registryTag,
      message: 'Image pushed successfully'
    });

  } catch (error) {
    console.error('Docker push endpoint error:', error);

    if ((error as any).statusCode) {
      res.status((error as any).statusCode).json({
        success: false,
        error: 'Service Error',
        message: (error as Error).message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during image push'
      });
    }
  }
});

/**
 * GET /api/docker/builds
 * Get list of all builds
 */
router.get('/builds', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const builds = dockerBuilder.getAllBuilds();

    // Filter sensitive information from logs if needed
    const filteredBuilds = builds.map(build => ({
      ...build,
      logs: req.query.includeLogs === 'true' ? build.logs : undefined
    }));

    res.json({
      success: true,
      data: filteredBuilds,
      count: filteredBuilds.length
    });

  } catch (error) {
    console.error('Docker builds list endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching builds'
    });
  }
});

/**
 * GET /api/docker/health
 * Health check for Docker builder service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dockerBuilder = getDockerBuilder(req);
    const isHealthy = await dockerBuilder.healthCheck();

    if (isHealthy) {
      res.json({
        success: true,
        status: 'healthy',
        message: 'Docker builder service is operational',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Docker builder service is not operational',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Docker health check endpoint error:', error);

    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Docker builder service health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;