#!/bin/bash

# Nautilus 이미지 배포 시 모니터링 자동 설정 스크립트
# 사용법: ./nautilus-deploy-with-monitoring.sh <image> <node-ip> <node-id> [node-name]

set -e

# 파라미터
NAUTILUS_IMAGE="${1}"
NODE_IP="${2}"
NODE_ID="${3}"
NODE_NAME="${4:-nautilus-node-$NODE_ID}"
BUILD_ID="${BUILD_ID:-$(date +%s)}"

# 환경 변수
BACKEND_API="${BACKEND_API:-http://localhost:3001}"
AUTH_TOKEN="${AUTH_TOKEN}"
APP_PORT="${APP_PORT:-8080}"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Nautilus 노드 배포 및 모니터링 설정${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "이미지: ${NAUTILUS_IMAGE}"
echo "노드 IP: ${NODE_IP}"
echo "노드 ID: ${NODE_ID}"
echo "노드 이름: ${NODE_NAME}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. SSH를 통해 원격 노드에 Docker Compose 파일 복사
echo -e "${YELLOW}📁 Docker Compose 파일 전송 중...${NC}"
scp docker-compose.nautilus-node.yml ${NODE_IP}:/tmp/docker-compose.yml

# 2. 환경 변수 파일 생성
echo -e "${YELLOW}🔧 환경 변수 파일 생성 중...${NC}"
cat <<EOF > /tmp/nautilus.env
NAUTILUS_IMAGE=${NAUTILUS_IMAGE}
NODE_ID=${NODE_ID}
NODE_NAME=${NODE_NAME}
NODE_IP=${NODE_IP}
BUILD_ID=${BUILD_ID}
APP_PORT=${APP_PORT}
BACKEND_API=${BACKEND_API}
AUTH_TOKEN=${AUTH_TOKEN}
EOF

# 3. 환경 변수 파일 전송
scp /tmp/nautilus.env ${NODE_IP}:/tmp/nautilus.env

# 4. 원격 노드에서 Docker Compose 실행
echo -e "${YELLOW}🐳 Docker 컨테이너 시작 중...${NC}"
ssh ${NODE_IP} << 'REMOTE_SCRIPT'
cd /tmp
# 기존 컨테이너 정리
docker-compose -f docker-compose.yml --env-file nautilus.env down 2>/dev/null || true

# 새 컨테이너 시작
docker-compose -f docker-compose.yml --env-file nautilus.env up -d

# 헬스 체크
sleep 10
if curl -s http://localhost:9100/metrics > /dev/null; then
    echo "✅ Node Exporter가 정상적으로 실행 중입니다"
else
    echo "❌ Node Exporter 시작 실패"
fi

if curl -s http://localhost:8080/metrics > /dev/null; then
    echo "✅ cAdvisor가 정상적으로 실행 중입니다"
else
    echo "⚠️  cAdvisor 시작 실패 (선택사항)"
fi
REMOTE_SCRIPT

# 5. 백엔드 API에 노드 등록 (로컬에서 실행)
echo -e "${YELLOW}📝 모니터링 시스템에 노드 등록 중...${NC}"
if [ -n "$AUTH_TOKEN" ]; then
    RESPONSE=$(curl -s -X POST ${BACKEND_API}/api/node-registry/register \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d "{
            \"nodeId\": \"${NODE_ID}\",
            \"nodeIp\": \"${NODE_IP}\",
            \"nodePort\": 9100,
            \"labels\": {
                \"node_name\": \"${NODE_NAME}\",
                \"type\": \"nautilus-runtime\",
                \"image\": \"${NAUTILUS_IMAGE}\",
                \"build_id\": \"${BUILD_ID}\",
                \"deployed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }
        }")

    if echo "$RESPONSE" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ 노드가 성공적으로 등록되었습니다${NC}"
    else
        echo -e "${RED}❌ 노드 등록 실패: $RESPONSE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  AUTH_TOKEN이 설정되지 않아 자동 등록을 건너뜁니다${NC}"
    echo "수동 등록 명령어:"
    echo "curl -X POST ${BACKEND_API}/api/node-registry/register \\"
    echo "  -H 'Authorization: Bearer <your-token>' \\"
    echo "  -d '{\"nodeId\": \"${NODE_ID}\", \"nodeIp\": \"${NODE_IP}\"}''"
fi

# 6. 최종 상태 확인
echo -e "${YELLOW}🔍 배포 상태 확인 중...${NC}"
ssh ${NODE_IP} "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Nautilus 노드 배포 및 모니터링 설정 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 모니터링 엔드포인트:"
echo "  - Node Exporter: http://${NODE_IP}:9100/metrics"
echo "  - cAdvisor: http://${NODE_IP}:8080/metrics"
echo "  - Application: http://${NODE_IP}:${APP_PORT}"
echo ""
echo "📈 Prometheus에서 확인:"
echo "  http://localhost:9090/targets"
echo ""
echo "📉 Grafana 대시보드:"
echo "  http://localhost:3000 (admin/admin)"