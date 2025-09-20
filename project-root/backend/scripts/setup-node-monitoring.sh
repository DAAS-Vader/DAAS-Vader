#!/bin/bash

# Node Exporter 자동 설치 스크립트
# Docker 빌드 노드에서 실행

set -e

NODE_IP="${1:-$(hostname -I | awk '{print $1}')}"
NODE_NAME="${2:-$(hostname)}"
EXPORTER_PORT="${3:-9100}"
CADVISOR_PORT="${4:-8080}"

echo "🚀 Setting up monitoring for node: $NODE_NAME ($NODE_IP)"

# 1. Node Exporter 설치
echo "📊 Installing Node Exporter..."
docker pull quay.io/prometheus/node-exporter:latest

# 기존 컨테이너 정리
docker stop node-exporter 2>/dev/null || true
docker rm node-exporter 2>/dev/null || true

# Node Exporter 실행
docker run -d \
  --name node-exporter \
  --restart unless-stopped \
  --pid="host" \
  --net="host" \
  -v "/:/host:ro,rslave" \
  quay.io/prometheus/node-exporter:latest \
  --path.rootfs=/host \
  --web.listen-address=:${EXPORTER_PORT} \
  --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|host|etc|rootfs/var/lib/docker/containers|rootfs/var/lib/docker/overlay2|rootfs/run/docker/netns|rootfs/var/lib/docker/aufs)($$|/)"

# 2. cAdvisor 설치 (Docker 컨테이너 모니터링)
echo "🐳 Installing cAdvisor for Docker monitoring..."
docker pull gcr.io/cadvisor/cadvisor:latest

# 기존 컨테이너 정리
docker stop cadvisor 2>/dev/null || true
docker rm cadvisor 2>/dev/null || true

# cAdvisor 실행
docker run -d \
  --name cadvisor \
  --restart unless-stopped \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --volume=/dev/disk/:/dev/disk:ro \
  --publish=${CADVISOR_PORT}:8080 \
  --privileged \
  --device=/dev/kmsg \
  gcr.io/cadvisor/cadvisor:latest

# 3. 방화벽 설정 (필요한 경우)
if command -v ufw &> /dev/null; then
    echo "🔥 Configuring firewall..."
    sudo ufw allow ${EXPORTER_PORT}/tcp
    sudo ufw allow ${CADVISOR_PORT}/tcp
fi

# 4. 헬스체크
echo "🔍 Checking services..."
sleep 5

if curl -s http://localhost:${EXPORTER_PORT}/metrics > /dev/null; then
    echo "✅ Node Exporter is running at http://${NODE_IP}:${EXPORTER_PORT}/metrics"
else
    echo "❌ Node Exporter failed to start"
    exit 1
fi

if curl -s http://localhost:${CADVISOR_PORT}/metrics > /dev/null; then
    echo "✅ cAdvisor is running at http://${NODE_IP}:${CADVISOR_PORT}/metrics"
else
    echo "⚠️  cAdvisor failed to start (optional)"
fi

echo "🎉 Monitoring setup complete!"
echo ""
echo "Add this node to your prometheus.yml:"
echo "  - targets: ['${NODE_IP}:${EXPORTER_PORT}']"
echo "    labels:"
echo "      node: '${NODE_NAME}'"
echo "      type: 'docker-build-node'"