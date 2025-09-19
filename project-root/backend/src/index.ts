import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authMiddleware } from './middleware/auth.js';

// Routes
import projectRoutes from './routes/project.js';
import sealRoutes from './routes/seal.js';
import dockerRoutes from './routes/docker.js';

const app = express();

// Sui client initialization for Nautilus
const suiClient = new SuiClient({
  url: getFullnodeUrl(config.nodeEnv === 'production' ? 'mainnet' : 'devnet')
});

// Make Sui client available throughout the app
app.locals.suiClient = suiClient;

// Nautilus-specific middleware
app.use((req, res, next) => {
  // Add Sui client to request context
  (req as any).suiClient = suiClient;

  // Add Nautilus headers for better compatibility
  res.setHeader('X-Powered-By', 'Nautilus-Sui');

  next();
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production' ? false : true, // Configure properly in production
  credentials: true
}));

// Logging middleware
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes with authentication for user-specific operations
app.use('/api/project', authMiddleware, projectRoutes);
app.use('/api/seal', authMiddleware, sealRoutes);
app.use('/api/docker', authMiddleware, dockerRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`🚀 DAAS Vader Backend running on port ${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`⛓️  Sui Network: ${config.nodeEnv === 'production' ? 'mainnet' : 'devnet'}`);
      console.log(`🔄 Nautilus Ready: Server configured for Sui Nautilus deployment`);

      if (config.nodeEnv === 'development') {
        console.log(`📚 API Documentation:`);
        console.log(`  POST /project/upload - Upload project files`);
        console.log(`  POST /project/from-github - Import from GitHub`);
        console.log(`  POST /project/build - Secure build service`);
        console.log(`  POST /seal/ticket - Generate decryption ticket`);
        console.log(`  POST /docker/build - Build Docker image from bundle`);
        console.log(`  GET /docker/build/:id - Get build status and logs`);
        console.log(`  POST /docker/push - Push image to registry`);
        console.log(`🏗️  Build Service: Runs on separate server for container builds`);
      }
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, shutting down gracefully`);
      
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