# DAAS Docker Builder Service

A secure Docker-in-Docker container building service for the DAAS Vader platform. This service enables secure containerization of user-uploaded code bundles with automatic Dockerfile generation and support for multiple programming languages.

## Overview

The Docker Builder Service provides:

- **Secure Docker-in-Docker builds** - Isolated container building environment
- **Automatic Dockerfile generation** - Smart detection of project types and automatic Dockerfile creation
- **Multi-language support** - Node.js, Python, Go, Rust, Java, and generic applications
- **Walrus integration** - Direct integration with Walrus storage for code bundle retrieval
- **Registry support** - Push built images to any Docker registry
- **Build monitoring** - Real-time build status, logs, and progress tracking
- **Nautilus integration** - Designed for deployment within Sui Nautilus enclaves

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   DAAS Backend      │    │  Docker Builder      │    │   Walrus Storage    │
│                     │    │    Service           │    │                     │
│ ┌─────────────────┐ │    │ ┌──────────────────┐ │    │ ┌─────────────────┐ │
│ │ NautilusService │◄┼────┼►│ DockerBuilder    │◄┼────┼►│   Code Bundles  │ │
│ │                 │ │    │ │    Service       │ │    │ │                 │ │
│ │ - buildWith     │ │    │ │                  │ │    │ │ - tar.gz files  │ │
│ │   DockerService │ │    │ │ - startBuild()   │ │    │ │ - blob storage  │ │
│ │ - getBuildStatus│ │    │ │ - getBuildStatus │ │    │ └─────────────────┘ │
│ │ - pushImage     │ │    │ │ - pushImage()    │ │    └─────────────────────┘
│ └─────────────────┘ │    │ └──────────────────┘ │
│                     │    │                      │    ┌─────────────────────┐
└─────────────────────┘    │ ┌──────────────────┐ │    │   Docker Registry   │
                           │ │   Docker-in-     │◄┼────┼►                    │
                           │ │     Docker       │ │    │ - Image storage     │
                           │ │                  │ │    │ - Multi-registry    │
                           │ │ - Build isolation│ │    │   support           │
                           │ │ - Security       │ │    └─────────────────────┘
                           │ └──────────────────┘ │
                           └──────────────────────┘
```

## Features

### 🔒 Security
- **Docker-in-Docker isolation** - Builds run in completely isolated containers
- **Resource limits** - CPU, memory, and storage limits to prevent abuse
- **Security hardening** - Non-root user, no-new-privileges, resource constraints
- **Build timeouts** - Automatic termination of long-running builds

### 🚀 Performance
- **Concurrent builds** - Support for multiple simultaneous builds
- **Build caching** - Docker layer caching for faster rebuilds
- **Cleanup automation** - Automatic cleanup of old builds and artifacts
- **Resource monitoring** - Real-time resource usage tracking

### 🛠 Developer Experience
- **Auto-detection** - Automatic project type detection and Dockerfile generation
- **Multi-language support** - Supports Node.js, Python, Go, Rust, Java, and more
- **Build logs** - Real-time build logs and progress tracking
- **Health checks** - Built-in health monitoring and status endpoints

## Quick Start

### 1. Local Development Setup

```bash
# Navigate to docker-builder directory
cd project-root/backend/docker-builder

# Build the Docker builder service image
docker build -t daas-docker-builder .

# Start the service with docker-compose
docker-compose up -d

# Check service status
curl http://localhost:3001/health
```

### 2. Environment Configuration

Create a `.env` file in the `docker-builder` directory:

```env
# Service Configuration
NODE_ENV=development
PORT=3001

# Build Configuration
DOCKER_BUILD_DIR=/tmp/docker-builds
MAX_CONCURRENT_BUILDS=3
BUILD_TIMEOUT=600

# Walrus Storage
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Registry Configuration (optional)
REGISTRY_URL=localhost:5000
REGISTRY_USERNAME=testuser
REGISTRY_PASSWORD=testpass
```

### 3. API Usage Examples

#### Start a Build

```bash
curl -X POST http://localhost:3001/api/docker/build \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "your-walrus-blob-id",
    "buildOptions": {
      "platform": "linux/amd64",
      "buildArgs": {
        "NODE_ENV": "production"
      },
      "labels": {
        "version": "1.0.0"
      }
    }
  }'
```

#### Check Build Status

```bash
curl http://localhost:3001/api/docker/build/{buildId}
```

#### Push to Registry

```bash
curl -X POST http://localhost:3001/api/docker/push \
  -H "Content-Type: application/json" \
  -d '{
    "buildId": "your-build-id",
    "registry": {
      "url": "your-registry.com",
      "username": "your-username",
      "password": "your-password",
      "namespace": "your-namespace"
    }
  }'
```

## API Reference

### Build Endpoints

#### POST `/api/docker/build`
Start a new Docker build from a Walrus code bundle.

**Request Body:**
```json
{
  "bundleId": "string",           // Required: Walrus blob ID
  "buildOptions": {               // Optional
    "platform": "string",         // Target platform (e.g., "linux/amd64")
    "dockerfile": "string",       // Custom Dockerfile path
    "buildArgs": "object",        // Build arguments
    "labels": "object",           // Docker labels
    "target": "string"            // Multi-stage build target
  },
  "registry": {                   // Optional: Auto-push after build
    "url": "string",
    "username": "string",
    "password": "string",
    "namespace": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "buildId": "a1b2c3d4",
  "message": "Build started successfully",
  "statusUrl": "/api/docker/build/a1b2c3d4"
}
```

#### GET `/api/docker/build/:buildId`
Get build status and logs.

**Response:**
```json
{
  "success": true,
  "data": {
    "buildId": "a1b2c3d4",
    "status": "building",         // pending|building|success|failed
    "progress": 45,               // Progress percentage
    "currentStep": "Step 3/8: RUN npm install",
    "logs": ["Step 1/8: FROM node:18-alpine", "..."],
    "error": null
  }
}
```

#### DELETE `/api/docker/build/:buildId`
Cancel an active build.

**Response:**
```json
{
  "success": true,
  "message": "Build cancelled successfully"
}
```

### Registry Endpoints

#### POST `/api/docker/push`
Push a built image to a Docker registry.

**Request Body:**
```json
{
  "buildId": "a1b2c3d4",
  "registry": {
    "url": "registry.example.com",
    "username": "your-username",
    "password": "your-password",
    "namespace": "your-namespace"
  }
}
```

**Response:**
```json
{
  "success": true,
  "registryTag": "registry.example.com/your-namespace/daas-app:a1b2c3d4",
  "message": "Image pushed successfully"
}
```

### Management Endpoints

#### GET `/api/docker/builds`
List all builds.

**Query Parameters:**
- `includeLogs` (boolean): Include build logs in response

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "buildId": "a1b2c3d4",
      "imageId": "sha256:abc123...",
      "imageTag": "daas-app:a1b2c3d4",
      "size": 256789123,
      "status": "success",
      "startTime": "2024-01-15T10:30:00Z",
      "endTime": "2024-01-15T10:32:45Z"
    }
  ],
  "count": 1
}
```

#### GET `/api/docker/health`
Health check for the Docker builder service.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "message": "Docker builder service is operational",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Supported Project Types

The Docker Builder Service automatically detects project types and generates appropriate Dockerfiles:

### Node.js Applications
- **Detection**: `package.json`
- **Base Image**: `node:18-alpine`
- **Features**: npm/yarn support, build scripts, health checks
- **Example**: Express.js, React, Next.js applications

### Python Applications
- **Detection**: `requirements.txt` or `pyproject.toml`
- **Base Image**: `python:3.11-slim`
- **Features**: pip/poetry support, virtual environments
- **Example**: Flask, Django, FastAPI applications

### Go Applications
- **Detection**: `go.mod`
- **Base Image**: `golang:1.21-alpine` (multi-stage)
- **Features**: Multi-stage builds, static binaries
- **Example**: Web servers, CLI tools

### Rust Applications
- **Detection**: `Cargo.toml`
- **Base Image**: `rust:1.70` (multi-stage)
- **Features**: Cargo build optimization, minimal runtime
- **Example**: Web services, system tools

### Java Applications
- **Detection**: `pom.xml` or `build.gradle`
- **Base Image**: `openjdk:17-jdk-slim` (multi-stage)
- **Features**: Maven/Gradle support, JRE runtime
- **Example**: Spring Boot, JAX-RS applications

### Generic Applications
- **Fallback**: When no specific type is detected
- **Base Image**: `alpine:latest`
- **Features**: Basic container with minimal dependencies

## Integration with DAAS Backend

The Docker Builder Service integrates seamlessly with the main DAAS backend through the `NautilusService`:

```typescript
// Example: Build a container from uploaded code
const nautilusService = new NautilusService();

// Start build
const buildId = await nautilusService.buildWithDockerService(
  bundleId,           // Walrus blob ID
  walletAddress,      // User wallet
  {
    platform: 'linux/amd64',
    buildArgs: { NODE_ENV: 'production' }
  }
);

// Monitor build progress
const status = await nautilusService.getDockerBuildStatus(buildId);

// Push to registry when ready
if (status?.status === 'success') {
  const registryTag = await nautilusService.pushDockerImage(buildId, {
    url: 'registry.example.com',
    username: 'user',
    password: 'pass'
  });
}
```

## Deployment

### Local Development
```bash
cd docker-builder
docker-compose up -d
```

### Production Deployment
```bash
# Build production image
docker build -t daas-docker-builder:latest .

# Deploy to Nautilus enclave
# (Specific deployment steps depend on Nautilus configuration)
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: daas-docker-builder
spec:
  replicas: 3
  selector:
    matchLabels:
      app: daas-docker-builder
  template:
    metadata:
      labels:
        app: daas-docker-builder
    spec:
      containers:
      - name: docker-builder
        image: daas-docker-builder:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MAX_CONCURRENT_BUILDS
          value: "2"
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
        securityContext:
          privileged: true
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
```

## Security Considerations

### Container Security
- **Privileged containers required** for Docker-in-Docker
- **Resource limits** prevent resource exhaustion attacks
- **Build timeouts** prevent infinite build loops
- **Non-root user** for application processes

### Network Security
- **Isolated networks** for build containers
- **Registry authentication** for secure image storage
- **TLS/HTTPS** for all external communications

### Data Security
- **Temporary build directories** automatically cleaned up
- **Build logs** sanitized to remove sensitive information
- **Access controls** for build endpoints

## Monitoring and Logging

### Health Monitoring
- **Service health check**: `/api/docker/health`
- **Docker daemon status**: Automatic Docker availability checking
- **Resource usage**: CPU, memory, and disk monitoring

### Build Monitoring
- **Real-time logs**: Streaming build output
- **Progress tracking**: Build step progress and ETA
- **Error reporting**: Detailed error messages and stack traces

### Observability
- **Structured logging**: JSON formatted logs for aggregation
- **Metrics collection**: Build success rates, duration, resource usage
- **Alerting**: Integration with monitoring systems

## Troubleshooting

### Common Issues

#### Build Fails to Start
```bash
# Check Docker daemon
docker version

# Check service logs
docker-compose logs docker-builder

# Verify Walrus connectivity
curl -I $WALRUS_AGGREGATOR/v1/stats
```

#### Build Times Out
```bash
# Increase timeout
export BUILD_TIMEOUT=1200  # 20 minutes

# Check resource limits
docker stats
```

#### Registry Push Fails
```bash
# Test registry connectivity
docker login your-registry.com

# Check credentials
curl -u username:password https://your-registry.com/v2/
```

### Debug Mode
```bash
# Enable debug logging
export NODE_ENV=development
export DEBUG=docker-builder:*

# Start with debug output
docker-compose up
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request

### Development Setup
```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.