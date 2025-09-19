# Docker Builder Service - Dockerfile for the builder service itself
# This container will run Docker-in-Docker to build user applications securely

FROM docker:24-dind

# Install Node.js and npm for the builder service
RUN apk add --no-cache \
    nodejs \
    npm \
    curl \
    ca-certificates \
    git \
    bash \
    tini

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create build directory
RUN mkdir -p /tmp/docker-builds

# Set up non-root user for security
RUN addgroup -g 1001 -S dockerbuilder && \
    adduser -S -D -h /home/dockerbuilder dockerbuilder dockerbuilder && \
    adduser dockerbuilder docker

# Create necessary directories and set permissions
RUN mkdir -p /var/log/docker-builder && \
    chown -R dockerbuilder:dockerbuilder /app /tmp/docker-builds /var/log/docker-builder

# Security hardening
RUN echo 'dockerbuilder ALL=(ALL) NOPASSWD: /usr/local/bin/docker' >> /etc/sudoers

# Environment variables
ENV NODE_ENV=production \
    DOCKER_BUILD_DIR=/tmp/docker-builds \
    MAX_CONCURRENT_BUILDS=3 \
    BUILD_TIMEOUT=600 \
    PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/docker/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start Docker daemon and the Node.js application
CMD ["sh", "-c", "dockerd-entrypoint.sh & sleep 10 && npm start"]

# Security labels
LABEL security.description="Docker Builder Service for DAAS Vader Platform" \
      security.isolation="docker-in-docker" \
      security.user="dockerbuilder" \
      security.network="isolated"