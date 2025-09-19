import express, { Request, Response } from 'express';
import { DockerBuilderService } from '../services/dockerBuilderService.js';
import { ServiceError, ValidationError } from '../types/index.js';

const router = express.Router();
const dockerBuilder = new DockerBuilderService();

/**
 * POST /api/docker/build
 * Build Docker image from code bundle
 */
router.post('/build', async (req: Request, res: Response) => {
  try {
    const { bundleId, buildOptions, registry } = req.body;

    // Validate required fields
    if (!bundleId) {
      throw new ValidationError('bundleId is required');
    }

    // Validate bundleId format (should be Walrus blob ID)
    if (typeof bundleId !== 'string' || bundleId.length < 10) {
      throw new ValidationError('Invalid bundleId format');
    }

    // Validate optional build options
    if (buildOptions) {
      if (buildOptions.platform && typeof buildOptions.platform !== 'string') {
        throw new ValidationError('Invalid platform format');
      }

      if (buildOptions.buildArgs && typeof buildOptions.buildArgs !== 'object') {
        throw new ValidationError('Invalid buildArgs format');
      }

      if (buildOptions.labels && typeof buildOptions.labels !== 'object') {
        throw new ValidationError('Invalid labels format');
      }

      if (buildOptions.target && typeof buildOptions.target !== 'string') {
        throw new ValidationError('Invalid target format');
      }

      if (buildOptions.dockerfile && typeof buildOptions.dockerfile !== 'string') {
        throw new ValidationError('Invalid dockerfile format');
      }
    }

    // Validate optional registry config
    if (registry) {
      if (!registry.url || !registry.username || !registry.password) {
        throw new ValidationError('Registry requires url, username, and password');
      }
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

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
    } else if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: 'Service Error',
        message: error.message
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
    const { buildId } = req.params;

    if (!buildId) {
      throw new ValidationError('buildId is required');
    }

    const buildStatus = dockerBuilder.getBuildStatus(buildId);

    if (!buildStatus) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Build not found'
      });
    }

    return res.json({
      success: true,
      data: buildStatus
    });

  } catch (error) {
    console.error('Docker build status endpoint error:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while fetching build status'
      });
    }
  }
});

/**
 * DELETE /api/docker/build/:buildId
 * Cancel an active build
 */
router.delete('/build/:buildId', async (req: Request, res: Response) => {
  try {
    const { buildId } = req.params;

    if (!buildId) {
      throw new ValidationError('buildId is required');
    }

    const cancelled = await dockerBuilder.cancelBuild(buildId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Build not found or already completed'
      });
    }

    return res.json({
      success: true,
      message: 'Build cancelled successfully'
    });

  } catch (error) {
    console.error('Docker build cancel endpoint error:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
    } else if (error instanceof ServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        error: 'Service Error',
        message: error.message
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while cancelling build'
      });
    }
  }
});

/**
 * POST /api/docker/push
 * Push built image to registry
 */
router.post('/push', async (req: Request, res: Response) => {
  try {
    const { buildId, registry } = req.body;

    // Validate required fields
    if (!buildId) {
      throw new ValidationError('buildId is required');
    }

    if (!registry || !registry.url || !registry.username || !registry.password) {
      throw new ValidationError('Registry configuration with url, username, and password is required');
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

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
    } else if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: 'Service Error',
        message: error.message
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
    const isHealthy = await dockerBuilder.healthCheck();

    if (isHealthy) {
      res.json({
        success: true,
        status: 'healthy',
        message: 'Docker builder service is operational'
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Docker builder service is not operational'
      });
    }

  } catch (error) {
    console.error('Docker health check endpoint error:', error);

    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Docker builder service health check failed'
    });
  }
});

export default router;