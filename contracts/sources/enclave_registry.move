module daas_vader::enclave_registry {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use std::option;

    /// Enclave 등록 정보 (Seal 통합 버전)
    public struct EnclaveInfo has key, store {
        id: UID,
        /// Enclave 고유 식별자
        enclave_id: String,
        /// PCR 값들 (Platform Configuration Registers)
        pcr_values: vector<vector<u8>>,
        /// Enclave의 공개키
        public_key: vector<u8>,
        /// 등록 시점
        registered_at: u64,
        /// 소유자 주소
        owner: address,
        /// Enclave 상태 (active, suspended, revoked)
        status: u8,
        /// Seal 관련 권한 레벨 (0=none, 1=basic, 2=advanced, 3=admin)
        seal_permission_level: u8,
        /// Seal 접근 만료 시간
        seal_expires_at: u64,
        /// 허용된 데이터 타입들
        allowed_data_types: vector<u8>,
    }

    /// Seal 통합을 위한 글로벌 Enclave 레지스트리
    public struct EnclaveRegistry has key {
        id: UID,
        /// 식별자별 등록된 모든 enclave들
        enclaves: Table<vector<u8>, ID>,
        /// Enclave ID를 정보로 매핑
        enclave_lookup: Table<String, ID>,
        /// 관리자 권한
        admin: address,
        /// 레지스트리 설정
        settings: RegistrySettings,
    }

    /// 레지스트리 구성 설정
    public struct RegistrySettings has store {
        /// PCR 검증 필요 여부
        require_pcr_validation: bool,
        /// 최대 enclave 생명주기 (초)
        max_enclave_lifetime: u64,
        /// 새 enclave을 위한 기본 seal 권한 레벨
        default_seal_level: u8,
        /// seal 권한의 자동 만료 (초)
        seal_permission_duration: u64,
    }

    /// 빌드 결과 증명
    public struct BuildAttestation has key, store {
        id: UID,
        /// 빌드를 수행한 Enclave ID
        enclave_id: String,
        /// 빌드된 이미지 해시
        image_hash: vector<u8>,
        /// 소스 코드 해시 (Walrus blob ID)
        source_hash: String,
        /// 빌드 시점
        build_time: u64,
        /// Enclave 서명
        signature: vector<u8>,
        /// 검증 상태
        verified: bool,
    }

    /// 상수 정의
    const ENCLAVE_STATUS_ACTIVE: u8 = 1;
    const ENCLAVE_STATUS_SUSPENDED: u8 = 2;
    const ENCLAVE_STATUS_REVOKED: u8 = 3;

    /// Seal 권한 레벨
    const SEAL_LEVEL_NONE: u8 = 0;
    const SEAL_LEVEL_BASIC: u8 = 1;
    const SEAL_LEVEL_ADVANCED: u8 = 2;
    const SEAL_LEVEL_ADMIN: u8 = 3;

    /// 데이터 타입 상수
    const DATA_TYPE_SECRETS: u8 = 0;
    const DATA_TYPE_CONFIG: u8 = 1;
    const DATA_TYPE_LOGS: u8 = 2;
    const DATA_TYPE_PUBLIC: u8 = 3;

    /// 에러 코드
    const E_INVALID_SIGNATURE: u64 = 1;
    const E_ENCLAVE_NOT_FOUND: u64 = 2;
    const E_ENCLAVE_NOT_ACTIVE: u64 = 3;
    const E_INVALID_PCR_VALUES: u64 = 4;
    const E_SEAL_PERMISSION_EXPIRED: u64 = 5;
    const E_INSUFFICIENT_SEAL_LEVEL: u64 = 6;
    const E_INVALID_DATA_TYPE: u64 = 7;
    const E_REGISTRY_NOT_INITIALIZED: u64 = 8;

    // ==================== 초기화 ====================

    /// 글로벌 enclave 레지스트리 초기화
    fun init(ctx: &mut TxContext) {
        let registry = EnclaveRegistry {
            id: object::new(ctx),
            enclaves: table::new(ctx),
            enclave_lookup: table::new(ctx),
            admin: tx_context::sender(ctx),
            settings: RegistrySettings {
                require_pcr_validation: true,
                max_enclave_lifetime: 2592000000, // 30일 (밀리초)
                default_seal_level: SEAL_LEVEL_BASIC,
                seal_permission_duration: 86400000, // 24시간 (밀리초)
            },
        };

        transfer::share_object(registry);
    }

    // ==================== Seal 통합 함수들 ====================

    /// enclave가 유효한 Seal 권한을 가지고 있는지 확인
    public fun validate_seal_access(
        enclave_info: &EnclaveInfo,
        data_type: u8,
        current_time: u64
    ): bool {
        // enclave가 활성 상태인지 확인
        if (enclave_info.status != ENCLAVE_STATUS_ACTIVE) {
            return false
        };

        // seal 권한 만료 확인
        if (enclave_info.seal_expires_at > 0 && current_time > enclave_info.seal_expires_at) {
            return false
        };

        // 데이터 타입이 허용되는지 확인
        if (!vector::contains(&enclave_info.allowed_data_types, &data_type)) {
            return false
        };

        // 데이터 타입별 최소 권한 레벨 확인
        let required_level = if (data_type == DATA_TYPE_SECRETS) {
            SEAL_LEVEL_ADVANCED
        } else if (data_type == DATA_TYPE_CONFIG) {
            SEAL_LEVEL_BASIC
        } else {
            SEAL_LEVEL_NONE
        };

        enclave_info.seal_permission_level >= required_level
    }

    /// 식별자로 enclave 가져오기 (seal_access_control에서 사용)
    public fun get_enclave_by_identity(
        registry: &EnclaveRegistry,
        identity: vector<u8>
    ): option::Option<ID> {
        if (table::contains(&registry.enclaves, identity)) {
            option::some(*table::borrow(&registry.enclaves, identity))
        } else {
            option::none()
        }
    }

    /// 식별자가 등록되고 활성 상태인지 확인
    public fun is_enclave_active(
        registry: &EnclaveRegistry,
        identity: vector<u8>
    ): bool {
        table::contains(&registry.enclaves, identity)
    }

    // ==================== 향상된 등록 ====================

    /// Enclave 등록 (Seal 통합 버전)
    public entry fun register_enclave(
        registry: &mut EnclaveRegistry,
        enclave_id: String,
        pcr_values: vector<vector<u8>>,
        public_key: vector<u8>,
        identity: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let seal_expires = current_time + registry.settings.seal_permission_duration;

        let enclave_info = EnclaveInfo {
            id: object::new(ctx),
            enclave_id,
            pcr_values,
            public_key,
            registered_at: current_time,
            owner: tx_context::sender(ctx),
            status: ENCLAVE_STATUS_ACTIVE,
            seal_permission_level: registry.settings.default_seal_level,
            seal_expires_at: seal_expires,
            allowed_data_types: vector[DATA_TYPE_CONFIG, DATA_TYPE_LOGS, DATA_TYPE_PUBLIC],
        };

        let enclave_object_id = object::id(&enclave_info);

        // 글로벌 레지스트리에 등록
        table::add(&mut registry.enclaves, identity, enclave_object_id);
        table::add(&mut registry.enclave_lookup, enclave_info.enclave_id, enclave_object_id);

        transfer::public_transfer(enclave_info, tx_context::sender(ctx));
    }

    /// enclave에 Seal 권한 부여 (관리자 전용)
    public entry fun grant_seal_permissions(
        registry: &EnclaveRegistry,
        enclave_info: &mut EnclaveInfo,
        permission_level: u8,
        allowed_data_types: vector<u8>,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 관리자 또는 enclave 소유자만 권한을 부여할 수 있음
        assert!(
            tx_context::sender(ctx) == registry.admin ||
            tx_context::sender(ctx) == enclave_info.owner,
            E_ENCLAVE_NOT_FOUND
        );

        let current_time = clock::timestamp_ms(clock);
        enclave_info.seal_permission_level = permission_level;
        enclave_info.allowed_data_types = allowed_data_types;
        enclave_info.seal_expires_at = current_time + duration_ms;
    }

    /// 빌드 증명 제출
    public entry fun submit_build_attestation(
        enclave_id: String,
        image_hash: vector<u8>,
        source_hash: String,
        build_time: u64,
        signature: vector<u8>,
        ctx: &mut TxContext
    ) {
        // TODO: Enclave 존재 및 활성 상태 확인
        // TODO: 서명 검증

        let attestation = BuildAttestation {
            id: object::new(ctx),
            enclave_id,
            image_hash,
            source_hash,
            build_time,
            signature,
            verified: true, // 검증 후 설정
        };

        transfer::public_transfer(attestation, tx_context::sender(ctx));
    }

    /// 증명 검증
    public fun verify_attestation(
        _enclave_id: &String,
        _signature: &vector<u8>,
        _message: &vector<u8>,
        _public_key: &vector<u8>
    ): bool {
        // TODO: 실제 서명 검증 로직 구현
        // AWS Nitro Enclave의 attestation 검증
        true
    }

    /// Enclave 상태 업데이트 (소유자 전용)
    public entry fun update_enclave_status(
        enclave_info: &mut EnclaveInfo,
        new_status: u8,
        ctx: &mut TxContext
    ) {
        assert!(enclave_info.owner == tx_context::sender(ctx), E_ENCLAVE_NOT_FOUND);
        enclave_info.status = new_status;
    }

    // === 조회 함수들 ===

    /// enclave 상태 가져오기
    public fun get_enclave_status(enclave_info: &EnclaveInfo): u8 {
        enclave_info.status
    }

    /// enclave 공개키 가져오기
    public fun get_enclave_public_key(enclave_info: &EnclaveInfo): &vector<u8> {
        &enclave_info.public_key
    }

    /// PCR 값들 가져오기
    public fun get_pcr_values(enclave_info: &EnclaveInfo): &vector<vector<u8>> {
        &enclave_info.pcr_values
    }

    /// 빌드가 검증되었는지 확인
    public fun is_build_verified(attestation: &BuildAttestation): bool {
        attestation.verified
    }

    /// 이미지 해시 가져오기
    public fun get_image_hash(attestation: &BuildAttestation): &vector<u8> {
        &attestation.image_hash
    }
}