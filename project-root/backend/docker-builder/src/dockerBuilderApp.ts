import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import the Docker builder service and routes from the main backend
import { DockerBuilderService } from '../../src/services/dockerBuilderService.js';
import dockerRoutes from './routes/dockerRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// Initialize Docker builder service
const dockerBuilder = new DockerBuilderService();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make docker builder service available to routes
app.locals.dockerBuilder = dockerBuilder;

// Routes
app.use('/api/docker', dockerRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dockerHealthy = await dockerBuilder.healthCheck();

    if (dockerHealthy) {
      res.json({
        status: 'healthy',
        service: 'docker-builder',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        service: 'docker-builder',
        error: 'Docker service not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'docker-builder',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DAAS Docker Builder',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      docker: {
        build: 'POST /api/docker/build',
        status: 'GET /api/docker/build/:buildId',
        cancel: 'DELETE /api/docker/build/:buildId',
        push: 'POST /api/docker/push',
        list: 'GET /api/docker/builds',
        health: 'GET /api/docker/health'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/docker/build',
      'GET /api/docker/build/:buildId',
      'DELETE /api/docker/build/:buildId',
      'POST /api/docker/push',
      'GET /api/docker/builds',
      'GET /api/docker/health'
    ]
  });
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Docker Builder Service Error:', error);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
    timestamp: new Date().toISOString()
  });
});

async function startServer(): Promise<void> {
  try {
    // Perform initial health check
    const dockerHealthy = await dockerBuilder.healthCheck();
    if (!dockerHealthy) {
      console.warn('⚠️ Docker service not available during startup');
    }

    // Start HTTP server
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🐳 DAAS Docker Builder Service running on port ${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🛡️ Docker Health: ${dockerHealthy ? 'OK' : 'WARNING'}`);
      console.log(`🔧 Build Directory: ${process.env.DOCKER_BUILD_DIR || '/tmp/docker-builds'}`);
      console.log(`⚡ Max Concurrent Builds: ${process.env.MAX_CONCURRENT_BUILDS || '3'}`);
      console.log(`⏰ Build Timeout: ${process.env.BUILD_TIMEOUT || '600'}s`);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`📚 API Documentation:`);
        console.log(`  POST /api/docker/build - Start Docker build`);
        console.log(`  GET /api/docker/build/:buildId - Get build status`);
        console.log(`  DELETE /api/docker/build/:buildId - Cancel build`);
        console.log(`  POST /api/docker/push - Push image to registry`);
        console.log(`  GET /api/docker/builds - List all builds`);
        console.log(`  GET /api/docker/health - Service health check`);
      }
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, shutting down Docker Builder gracefully`);

      server.close(() => {
        console.log('📴 HTTP server closed');
        console.log('✅ Docker Builder shutdown complete');
        process.exit(0);
      });

      // Force close after 15 seconds
      setTimeout(() => {
        console.error('💥 Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 15000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start Docker Builder Service:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();