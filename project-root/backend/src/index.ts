import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { connectDB, closeConnections } from './db/connection.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
// import { authMiddleware } from './middleware/auth.js'; // Removed for hackathon

// Routes
import projectRoutes from './routes/project.js';
import sealRoutes from './routes/seal.js';
import healthRoutes from './routes/health.js';

const app = express();

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

// Health check route (no auth required)
app.use('/health', healthRoutes);

// Routes (no authentication required for hackathon)
app.use('/api/project', projectRoutes);
app.use('/api/seal', sealRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    // Connect to database
    try {
      await connectDB();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.warn('⚠️  Database connection failed, continuing without database for development mode');
      console.warn('DB Error:', dbError);
    }

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`🚀 DAAS Vader Backend running on port ${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Database: ${config.database.url.split('@')[1] || 'configured'}`);
      console.log(`🏥 Health check: http://localhost:${config.port}/health`);
      
      if (config.nodeEnv === 'development') {
        console.log(`📚 API Documentation:`);
        console.log(`  POST /project/upload - Upload project files`);
        console.log(`  POST /project/from-github - Import from GitHub`);
        console.log(`  GET /project/bundles - List project bundles`);
        console.log(`  GET /project/bundles/:id - Get bundle details`);
        console.log(`  GET /project/bundles/:id/tree - Get file tree structure`);
        console.log(`  GET /project/bundles/:id/files/* - Get file content`);
        console.log(`  POST /seal/ticket - Generate decryption ticket`);
      }
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, shutting down gracefully`);
      
      server.close(async () => {
        console.log('📴 HTTP server closed');
        
        try {
          await closeConnections();
          console.log('✅ All connections closed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
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