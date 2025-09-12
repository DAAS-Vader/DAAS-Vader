1. docs/
역할 분담표 (예: roles.md)
진행상황 체크리스트 (예: progress.md)
기술/아키텍처 설명 자료
2. frontend/
사용자 대시보드, 리소스 상태 확인 UI 등
npm 기반으로 React, Next.js 등 사용 가능
3. backend/
API 서버, 인증, 리소스 요청/중재 로직
Suinetwork 및 Walrus와 통신하는 부분
4. chain/
온체인 자원 중재, staking 관련 smart contract 연동 코드
Suinetwork SDK, contract ABI 등 포함
5. kubernetes/
K8s 매니페스트(YAML), 배포 스크립트, Load Balancer 설정
노드 관리, 리소스 할당 정책 등
6. walrus/
코드 업로드, 실행 관리 로직
resource provider가 자신의 노드에서 코드 실행하는 부분
7. scripts/
CI/CD, 자동화, 배포, 개발환경 초기화 스크립트
8. configs/
환경변수, 설정 파일, 예시 config (예: config.example.json)
9. tests/
각 파트별 테스트 코드
10. .github/
이슈/PR 템플릿, 워크플로우, 자동화 관련