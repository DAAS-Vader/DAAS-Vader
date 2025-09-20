import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authMiddleware } from './middleware/auth.js';
import { logger, createRequestLogger } from './services/logger.js';
import { prometheusMiddleware, getPrometheusService } from './services/prometheusService.js';
import {
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  speedLimiter,
  securityHeaders,
  inputSanitization,
  productionCheck,
  corsSecurityOptions
} from './middleware/security.js';

// Routes
import projectRoutes from './routes/project.js';
import sealRoutes from './routes/seal.js';
import keyServerRoutes from './routes/keyServer.js';
import monitoringRoutes from './routes/monitoring.js';
import prometheusRoutes from './routes/prometheus.js';
import dockerRoutes from './routes/docker.js';
import nodeRegistryRoutes from './routes/nodeRegistry.js';
import monitoringConfigRoutes from './routes/monitoringConfig.js';

const app = express();

// Sui client initialization
const suiClient = new SuiClient({
  url: getFullnodeUrl(config.nodeEnv === 'production' ? 'mainnet' : 'devnet')
});

// Make Sui client available throughout the app
app.locals.suiClient = suiClient;

// Sui blockchain middleware
app.use((req, res, next) => {
  // Add Sui client to request context
  (req as any).suiClient = suiClient;

  // Add Sui blockchain headers
  res.setHeader('X-Powered-By', 'DAAS-Vader-Sui');

  next();
});

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(cors(corsSecurityOptions));
app.use(speedLimiter);
app.use(generalRateLimit);
app.use(productionCheck);
app.use(inputSanitization);

// Logging middleware
app.use(createRequestLogger());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Prometheus monitoring middleware (before routes)
app.use(prometheusMiddleware());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public routes (no auth required)
app.use('/prometheus', prometheusRoutes); // Prometheus management endpoints
app.get('/metrics', async (req, res) => {
  // Standard Prometheus metrics endpoint
  try {
    const prometheus = await import('./services/prometheusService.js');
    const prometheusService = prometheus.getPrometheusService();
    const metrics = await prometheusService.getMetrics();

    res.set('Content-Type', prometheusService.getRegister().contentType);
    res.status(200).send(metrics);
  } catch (error) {
    console.error('Prometheus metrics error:', error);
    res.status(500).send('# Error retrieving metrics\n');
  }
});

// Routes with authentication for user-specific operations
app.use('/api/project', uploadRateLimit, authMiddleware, projectRoutes);
app.use('/api/seal', authRateLimit, authMiddleware, sealRoutes);
app.use('/api/key-server', authRateLimit, authMiddleware, keyServerRoutes);
app.use('/api/monitoring', authMiddleware, monitoringRoutes);
app.use('/api/docker', uploadRateLimit, authMiddleware, dockerRoutes);
app.use('/api/node-registry', authMiddleware, nodeRegistryRoutes);
app.use('/api/monitoring-config', authMiddleware, monitoringConfigRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    // Initialize monitoring service
    const monitoring = getPrometheusService();
    console.log('📊 Monitoring service initialized');

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info('DAAS Vader Backend started', {
        port: config.port,
        environment: config.nodeEnv,
        suiNetwork: config.nodeEnv === 'production' ? 'mainnet' : 'devnet',
        nodeVersion: process.version,
        processId: process.pid
      });

      console.log(`🚀 DAAS Vader Backend running on port ${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`⛓️  Sui Network: ${config.nodeEnv === 'production' ? 'mainnet' : 'devnet'}`);
      console.log(`🔄 Build Service Ready: Server configured for Docker build service`);
      console.log(`📊 Prometheus Metrics: http://localhost:${config.port}/metrics`);

      if (config.nodeEnv === 'development') {
        console.log(`📚 API Documentation:`);
        console.log(`  POST /project/upload - Upload project files`);
        console.log(`  POST /project/from-github - Import from GitHub`);
        console.log(`  POST /project/build - Secure build service`);
        console.log(`  POST /seal/* - Enhanced Seal API with Move contracts`);
        console.log(`  POST /key-server/* - Key management and distribution`);
        console.log(`  GET /monitoring/* - System monitoring and alerts`);
        console.log(`  GET /metrics - Prometheus metrics endpoint`);
        console.log(`  POST /docker/build - Build Docker image from bundle`);
        console.log(`  GET /docker/build/:id - Get build status and logs`);
        console.log(`  POST /docker/push - Push image to registry`);
        console.log(`🏗️  Build Service: Runs on separate server for container builds`);
        console.log(`🔐 Seal v2: Enhanced security with Sui Move contracts`);
        console.log(`🔑 Key Server: Distributed key management infrastructure`);
        console.log(`📊 Monitoring: Real-time system monitoring and alerting`);
      }
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, shutting down gracefully`);

      // Shutdown monitoring service
      try {
        monitoring.shutdown();
      } catch (error) {
        console.warn('⚠️ Warning during monitoring shutdown:', error);
      }

      server.close(() => {
        console.log('📴 HTTP server closed');
        console.log('✅ All connections closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('💥 Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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