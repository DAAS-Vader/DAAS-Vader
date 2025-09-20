module daas_vader::node_registry {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use sui::address;

    /// 노드 메타데이터 구조체
    public struct NodeMetadata has store, drop {
        /// CPU 코어 수
        cpu_cores: u32,
        /// 메모리 크기 (GB)
        memory_gb: u32,
        /// 스토리지 크기 (GB)
        storage_gb: u32,
        /// 대역폭 (Mbps)
        bandwidth_mbps: u32,
        /// 지역 정보
        region: String,
        /// 제공자 지갑 주소
        provider_address: address,
        /// 노드 상태 (active, inactive, maintenance)
        status: u8,
        /// 등록 시점
        registered_at: u64,
        /// 마지막 업데이트 시점
        last_updated: u64,
    }

    /// 노드 레지스트리 (전역 상태)
    public struct NodeRegistry has key {
        id: UID,
        /// provider_address -> NodeMetadata 매핑
        nodes: Table<address, NodeMetadata>,
        /// 전체 노드 수
        total_nodes: u64,
        /// 활성 노드 수
        active_nodes: u64,
    }

    /// 노드 상태 상수
    const NODE_STATUS_ACTIVE: u8 = 1;
    const NODE_STATUS_INACTIVE: u8 = 2;
    const NODE_STATUS_MAINTENANCE: u8 = 3;

    /// 에러 코드
    const E_NODE_ALREADY_EXISTS: u64 = 1;
    const E_NODE_NOT_FOUND: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;
    const E_INVALID_STATUS: u64 = 4;

    /// 레지스트리 초기화 (한 번만 호출)
    fun init(ctx: &mut TxContext) {
        let registry = NodeRegistry {
            id: object::new(ctx),
            nodes: table::new(ctx),
            total_nodes: 0,
            active_nodes: 0,
        };
        transfer::share_object(registry);
    }

    /// 노드 등록 (트랜잭션 발신자 기반 검증)
    public entry fun register_node(
        registry: &mut NodeRegistry,
        cpu_cores: u32,
        memory_gb: u32,
        storage_gb: u32,
        bandwidth_mbps: u32,
        region: String,
        ctx: &mut TxContext
    ) {
        let provider_address = tx_context::sender(ctx);

        // 이미 등록된 노드인지 확인
        assert!(!table::contains(&registry.nodes, provider_address), E_NODE_ALREADY_EXISTS);

        let node_metadata = NodeMetadata {
            cpu_cores,
            memory_gb,
            storage_gb,
            bandwidth_mbps,
            region,
            provider_address,
            status: NODE_STATUS_ACTIVE,
            registered_at: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
        };

        table::add(&mut registry.nodes, provider_address, node_metadata);
        registry.total_nodes = registry.total_nodes + 1;
        registry.active_nodes = registry.active_nodes + 1;
    }

    /// 노드 정보 업데이트 (본인만 수정 가능)
    public entry fun update_node(
        registry: &mut NodeRegistry,
        cpu_cores: u32,
        memory_gb: u32,
        storage_gb: u32,
        bandwidth_mbps: u32,
        region: String,
        ctx: &mut TxContext
    ) {
        let provider_address = tx_context::sender(ctx);

        assert!(table::contains(&registry.nodes, provider_address), E_NODE_NOT_FOUND);

        let node_metadata = table::borrow_mut(&mut registry.nodes, provider_address);
        node_metadata.cpu_cores = cpu_cores;
        node_metadata.memory_gb = memory_gb;
        node_metadata.storage_gb = storage_gb;
        node_metadata.bandwidth_mbps = bandwidth_mbps;
        node_metadata.region = region;
        node_metadata.last_updated = tx_context::epoch(ctx);
    }

    /// 노드 상태 변경 (본인만 변경 가능)
    public entry fun update_node_status(
        registry: &mut NodeRegistry,
        new_status: u8,
        ctx: &mut TxContext
    ) {
        let provider_address = tx_context::sender(ctx);

        assert!(table::contains(&registry.nodes, provider_address), E_NODE_NOT_FOUND);
        assert!(new_status >= 1 && new_status <= 3, E_INVALID_STATUS);

        let node_metadata = table::borrow_mut(&mut registry.nodes, provider_address);
        let old_status = node_metadata.status;
        node_metadata.status = new_status;
        node_metadata.last_updated = tx_context::epoch(ctx);

        // 활성 노드 수 업데이트
        if (old_status == NODE_STATUS_ACTIVE && new_status != NODE_STATUS_ACTIVE) {
            registry.active_nodes = registry.active_nodes - 1;
        } else if (old_status != NODE_STATUS_ACTIVE && new_status == NODE_STATUS_ACTIVE) {
            registry.active_nodes = registry.active_nodes + 1;
        };
    }

    /// 노드 삭제 (본인만 삭제 가능)
    public entry fun remove_node(
        registry: &mut NodeRegistry,
        ctx: &mut TxContext
    ) {
        let provider_address = tx_context::sender(ctx);

        assert!(table::contains(&registry.nodes, provider_address), E_NODE_NOT_FOUND);

        let node_metadata = table::remove(&mut registry.nodes, provider_address);
        registry.total_nodes = registry.total_nodes - 1;

        if (node_metadata.status == NODE_STATUS_ACTIVE) {
            registry.active_nodes = registry.active_nodes - 1;
        };
    }

    // === 조회 함수들 ===

    /// 특정 노드 정보 조회 (주소 기반)
    public fun get_node_metadata(
        registry: &NodeRegistry,
        provider_address: address
    ): &NodeMetadata {
        table::borrow(&registry.nodes, provider_address)
    }

    /// 노드 존재 여부 확인 (주소 기반)
    public fun node_exists(
        registry: &NodeRegistry,
        provider_address: address
    ): bool {
        table::contains(&registry.nodes, provider_address)
    }

    /// 전체 노드 수 조회
    public fun get_total_nodes(registry: &NodeRegistry): u64 {
        registry.total_nodes
    }

    /// 활성 노드 수 조회
    public fun get_active_nodes(registry: &NodeRegistry): u64 {
        registry.active_nodes
    }

    /// 노드 메타데이터 필드 조회 함수들
    public fun get_cpu_cores(metadata: &NodeMetadata): u32 {
        metadata.cpu_cores
    }

    public fun get_memory_gb(metadata: &NodeMetadata): u32 {
        metadata.memory_gb
    }

    public fun get_storage_gb(metadata: &NodeMetadata): u32 {
        metadata.storage_gb
    }

    public fun get_bandwidth_mbps(metadata: &NodeMetadata): u32 {
        metadata.bandwidth_mbps
    }

    public fun get_region(metadata: &NodeMetadata): &String {
        &metadata.region
    }

    public fun get_provider_address(metadata: &NodeMetadata): address {
        metadata.provider_address
    }

    public fun get_status(metadata: &NodeMetadata): u8 {
        metadata.status
    }

    public fun get_registered_at(metadata: &NodeMetadata): u64 {
        metadata.registered_at
    }

    public fun get_last_updated(metadata: &NodeMetadata): u64 {
        metadata.last_updated
    }

    /// 상태 확인 헬퍼 함수들
    public fun is_active(metadata: &NodeMetadata): bool {
        metadata.status == NODE_STATUS_ACTIVE
    }

    public fun is_inactive(metadata: &NodeMetadata): bool {
        metadata.status == NODE_STATUS_INACTIVE
    }

    public fun is_maintenance(metadata: &NodeMetadata): bool {
        metadata.status == NODE_STATUS_MAINTENANCE
    }

    // === Test-only functions ===
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx)
    }
}