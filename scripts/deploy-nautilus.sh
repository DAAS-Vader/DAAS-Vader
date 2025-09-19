#!/bin/bash

# DAAS Vader Nautilus TEE 배포 스크립트

set -e

echo "🚀 DAAS Vader Nautilus TEE 배포 시작..."

# 환경 변수 확인
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ AWS_ACCOUNT_ID 환경변수가 설정되지 않았습니다."
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    export AWS_REGION="us-west-2"
fi

# 1. Reproducible Build
echo "📦 1. Reproducible Build 실행..."
cd /Users/kh/Github/DAAS-Vader/project-root/backend
npm run build

# 2. Docker 이미지 빌드 (Reproducible)
echo "🐳 2. Reproducible Docker 이미지 빌드..."
docker build -f ../../nautilus/Dockerfile.reproducible -t daas-vader-enclave:latest .

# 3. Enclave Image File (EIF) 생성
echo "🔒 3. Enclave Image File 생성..."
cd ../../nautilus
nitro-cli build-enclave --docker-uri daas-vader-enclave:latest --output-file daas-vader.eif

# 4. PCR 값 추출
echo "📋 4. PCR 값 추출..."
nitro-cli describe-eif --eif-path daas-vader.eif > enclave-measurements.json

# 5. AWS에 Enclave 배포
echo "☁️ 5. AWS Nitro Enclave 배포..."
aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --instance-type m5.large \
    --key-name your-key-pair \
    --security-group-ids sg-xxxxxxxxx \
    --subnet-id subnet-xxxxxxxxx \
    --user-data file://user-data.sh \
    --enclave-options Enabled=true \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=DAAS-Vader-Enclave}]'

# 6. 배포 상태 확인
echo "✅ 6. 배포 상태 확인..."
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=DAAS-Vader-Enclave" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

echo "📍 Enclave Instance ID: $INSTANCE_ID"

# 7. Sui 체인에 Enclave 등록 (TODO)
echo "⛓️ 7. Sui 체인에 Enclave 등록..."
echo "   - Move 컨트랙트 배포 필요"
echo "   - PCR 값들과 공개키 등록 필요"

echo "🎉 Nautilus TEE 배포 완료!"
echo "📝 다음 단계:"
echo "   1. Move 컨트랙트 배포"
echo "   2. Enclave 등록 트랜잭션 실행"
echo "   3. 빌드 테스트 실행"