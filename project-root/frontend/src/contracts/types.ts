// 컨트랙트 관련 타입 정의

export interface NodeMetadata {
  cpu_cores: number
  memory_gb: number
  storage_gb: number
  bandwidth_mbps: number
  region: string
  provider_address: string
  status: number
  registered_at: number
  last_updated: number
}

export interface NodeRegistryState {
  total_nodes: number
  active_nodes: number
  nodes: Map<string, NodeMetadata>
}

// 노드 상태 상수
export const NODE_STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
  MAINTENANCE: 3
} as const

export type NodeStatus = typeof NODE_STATUS[keyof typeof NODE_STATUS]

// 컨트랙트 주소 (배포된 컨트랙트 가정)
// NOTE: node_registry 컨트랙트가 삭제되었으므로 더미 값 사용 중
export const CONTRACT_CONFIG = {
  PACKAGE_ID: '', // node_registry 컨트랙트 미배포
  REGISTRY_OBJECT_ID: '', // node_registry 레지스트리 없음
  MODULE_NAME: 'node_registry',
} as const

// Move 함수 이름
export const MOVE_FUNCTIONS = {
  REGISTER_NODE: 'register_node',
  UPDATE_NODE: 'update_node',
  UPDATE_NODE_STATUS: 'update_node_status',
  REMOVE_NODE: 'remove_node',
  GET_NODE_METADATA: 'get_node_metadata',
  NODE_EXISTS: 'node_exists',
  GET_TOTAL_NODES: 'get_total_nodes',
  GET_ACTIVE_NODES: 'get_active_nodes',
} as const

// 작업 요청 관련 타입들
export interface JobRequirements {
  cpu_cores: number
  memory_gb: number
  storage_gb: number
  bandwidth_mbps: number
}

export interface JobRequest {
  id: string
  requester: string
  provider_address: string
  project_name: string
  requirements: JobRequirements
  estimated_duration: number
  offered_price: number
  status: number
  created_at: number
  updated_at: number
}

// 작업 요청 상태 상수
export const JOB_STATUS = {
  PENDING: 1,
  ACCEPTED: 2,
  REJECTED: 3,
  COMPLETED: 4
} as const

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS]

// 작업 요청 컨트랙트 설정
export const JOB_CONTRACT_CONFIG = {
  PACKAGE_ID: '0x123456789abcdef', // 같은 패키지
  REGISTRY_OBJECT_ID: '0xfedcba987654321', // 가정: 작업 요청 레지스트리 오브젝트 ID
  MODULE_NAME: 'job_requests',
} as const

// 작업 요청 Move 함수 이름
export const JOB_MOVE_FUNCTIONS = {
  CREATE_JOB_REQUEST: 'create_job_request',
  UPDATE_REQUEST_STATUS: 'update_request_status',
  GET_PROVIDER_REQUESTS: 'get_provider_requests',
  GET_REQUESTER_REQUESTS: 'get_requester_requests',
  GET_REQUEST: 'get_request',
} as const

// 지역 옵션
export const REGIONS = [
  { value: 'Asia-Seoul', label: '아시아 (서울)' },
  { value: 'Asia-Tokyo', label: '아시아 (도쿄)' },
  { value: 'Asia-Singapore', label: '아시아 (싱가포르)' },
  { value: 'US-East', label: '미국 (동부)' },
  { value: 'US-West', label: '미국 (서부)' },
  { value: 'Europe-London', label: '유럽 (런던)' },
  { value: 'Europe-Frankfurt', label: '유럽 (프랑크푸르트)' }
] as const