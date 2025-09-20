# DAAS Vader Backend - 프로덕션 배포 가이드

## 개요

이 문서는 DAAS Vader Backend를 프로덕션 환경에 안전하게 배포하는 방법을 설명합니다.

## 🚀 빠른 시작

### 1. 환경 준비

```bash
# 프로덕션 환경 변수 설정
cp .env.example .env.production
# .env.production 파일을 편집하여 프로덕션 값으로 변경

# 프로덕션 준비 상태 확인
./scripts/production-check.sh
```

### 2. Docker로 배포

```bash
# 프로덕션 환경으로 배포
./scripts/deploy.sh production

# 또는 수동으로
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. 상태 확인

```bash
# 헬스 체크
curl http://localhost:3000/api/monitoring/health

# 상세 상태 확인
curl http://localhost:3000/api/monitoring/health/detailed
```

## 📋 배포 전 체크리스트

### 필수 사항

- [ ] Node.js 18+ 설치 확인
- [ ] Docker 및 Docker Compose 설치
- [ ] 프로덕션 환경 변수 설정 (`.env.production`)
- [ ] SSL 인증서 준비 (`certs/cert.pem`, `certs/key.pem`)
- [ ] 데이터베이스 연결 설정
- [ ] Sui 메인넷 설정 확인
- [ ] Seal v2 컨트랙트 메인넷 주소 설정

### 보안 설정

- [ ] `NODE_ENV=production` 설정
- [ ] 개발용 토큰 비활성화 (`DEV_ADMIN_TOKEN=disabled-in-production`)
- [ ] 강력한 세션 시크릿 설정 (32자 이상)
- [ ] TEE 보안 레벨 최대로 설정 (`TEE_SECURITY_LEVEL=maximum`)
- [ ] CORS 허용 도메인 제한 (`ALLOWED_ORIGINS`)
- [ ] Rate limiting 설정 확인
- [ ] API 키 설정 (필요한 경우)

### 모니터링 설정

- [ ] 로그 디렉토리 생성 및 권한 설정
- [ ] 알림 웹훅 설정 (`ALERT_WEBHOOK_URL`)
- [ ] 이메일 알림 설정 (선택사항)
- [ ] Slack 알림 설정 (선택사항)

## 🏗️ 배포 아키텍처

```
┌─────────────────┐
│     Nginx       │ ← Load Balancer / Reverse Proxy
│   (Port 80/443) │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ DAAS Backend    │ ← Main Application
│   (Port 3000)   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│     Redis       │ ← Cache / Session Store
│   (Port 6379)   │
└─────────────────┘
```

## 🔧 환경별 설정

### Development
```bash
# 개발 환경 배포
./scripts/deploy.sh development
```

### Staging
```bash
# 스테이징 환경 배포
./scripts/deploy.sh staging
```

### Production
```bash
# 프로덕션 환경 배포
./scripts/deploy.sh production v1.0.0
```

## 📊 모니터링 엔드포인트

### 헬스 체크

- `GET /api/monitoring/health` - 빠른 헬스 체크
- `GET /api/monitoring/health/detailed` - 상세 시스템 상태
- `GET /api/monitoring/readiness` - Kubernetes 스타일 readiness
- `GET /api/monitoring/liveness` - Kubernetes 스타일 liveness

### 메트릭 및 대시보드

- `GET /api/monitoring/dashboard` - 전체 대시보드 데이터
- `GET /api/monitoring/metrics` - 시스템 메트릭
- `GET /api/monitoring/alerts` - 활성 알림 목록

## 🔐 보안 기능

### Rate Limiting
- 일반 API: 15분당 100요청
- 인증 API: 15분당 5요청
- 업로드 API: 1시간당 10요청

### 보안 헤더
- HSTS (프로덕션에서 자동 활성화)
- CSP (Content Security Policy)
- XSS Protection
- Frame Options (Clickjacking 방지)

### 입력 검증
- SQL Injection 패턴 탐지
- XSS 패턴 탐지
- 악성 입력 자동 차단

## 🐳 Docker 설정

### Multi-stage Build
```dockerfile
# 빌드 스테이지에서 최적화된 이미지 생성
FROM node:20-alpine AS builder
# ... 빌드 과정

# 프로덕션 스테이지에서 최소한의 런타임 환경
FROM node:20-alpine AS production
# ... 프로덕션 설정
```

### 컨테이너 보안
- 비root 사용자로 실행
- 보안 업데이트 자동 적용
- 최소한의 베이스 이미지 사용 (Alpine Linux)
- 헬스 체크 내장

## 📝 로깅

### 로그 레벨
- `error`: 시스템 오류
- `warn`: 경고 사항
- `info`: 일반 정보
- `http`: HTTP 요청/응답
- `debug`: 디버그 정보 (개발 환경만)

### 로그 형식
- **개발**: 사람이 읽기 쉬운 형식
- **프로덕션**: JSON 형식 (구조화된 로그)

### 특별한 로그 이벤트
- **보안 이벤트**: 의심스러운 활동 탐지
- **감사 이벤트**: 중요한 작업 추적
- **성능 이벤트**: 느린 응답 시간 추적
- **비즈니스 이벤트**: 주요 비즈니스 메트릭

## 🔄 배포 프로세스

### 자동화된 배포
1. **준비 단계**: 의존성 확인, 환경 검증
2. **빌드 단계**: TypeScript 컴파일, Docker 이미지 빌드
3. **배포 단계**: 컨테이너 교체, 서비스 시작
4. **검증 단계**: 헬스 체크, 기능 테스트
5. **마무리 단계**: 로그 확인, 모니터링 설정

### 롤백 프로세스
```bash
# 자동 롤백 (헬스 체크 실패 시)
./scripts/deploy.sh rollback

# 수동 롤백
docker-compose down
docker-compose up -d --build
```

## 🚨 장애 대응

### 일반적인 문제들

#### 서비스가 시작되지 않는 경우
```bash
# 로그 확인
docker-compose logs daas-backend

# 컨테이너 상태 확인
docker-compose ps

# 환경 변수 확인
docker-compose exec daas-backend printenv
```

#### 헬스 체크 실패
```bash
# 상세 헬스 체크
curl -v http://localhost:3000/api/monitoring/health/detailed

# 서비스별 상태 확인
curl http://localhost:3000/api/monitoring/dashboard
```

#### 성능 저하
```bash
# 메트릭 확인
curl http://localhost:3000/api/monitoring/metrics

# 리소스 사용량 확인
docker stats daas-backend
```

### 알림 설정

#### Webhook 알림
```bash
# .env.production에 설정
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

#### 이메일 알림
```bash
# SMTP 설정
ALERT_EMAIL_SMTP=smtp.gmail.com:587
ALERT_EMAIL_USER=your-email@gmail.com
ALERT_EMAIL_PASSWORD=your-app-password
ALERT_EMAIL_TO=admin@company.com,ops@company.com
```

#### Slack 알림
```bash
# Slack 웹훅 설정
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/...
ALERT_SLACK_CHANNEL=#alerts
```

## 🔧 유지보수

### 로그 로테이션
```bash
# 로그 파일 정리 (자동으로 수행됨)
# 최대 파일 크기: 20MB
# 보관 기간: 14일
```

### 업데이트
```bash
# 의존성 업데이트
npm update

# 보안 패치 적용
npm audit fix

# 시스템 업데이트 확인
./scripts/production-check.sh
```

### 백업
```bash
# 설정 파일 백업
tar -czf backup-$(date +%Y%m%d).tar.gz .env.production certs/ logs/

# 컨테이너 이미지 백업
docker save daas-vader-backend:latest | gzip > daas-backend-backup.tar.gz
```

## 📚 추가 리소스

- [Docker 설정 가이드](./docker-compose.yml)
- [Nginx 설정 예제](./nginx.conf)
- [보안 설정 상세](./src/middleware/security.ts)
- [모니터링 가이드](./src/services/monitoring.ts)
- [로깅 설정](./src/services/logger.ts)

---

## 📞 지원

배포 관련 문제가 발생하면:

1. `./scripts/production-check.sh` 실행하여 문제 진단
2. 로그 파일 확인 (`logs/` 디렉토리)
3. 헬스 체크 엔드포인트 확인
4. GitHub Issues에 문제 보고

**긴급 상황**: 프로덕션 서비스 장애 시 즉시 롤백을 수행하고 문제를 분석합니다.