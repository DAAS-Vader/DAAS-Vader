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

// 컨트랙트 주소 (실제 배포 후 업데이트 필요)
export const CONTRACT_CONFIG = {
  PACKAGE_ID: '0x0', // TODO: 실제 패키지 ID로 업데이트
  REGISTRY_OBJECT_ID: '0x0', // TODO: 실제 레지스트리 오브젝트 ID로 업데이트
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