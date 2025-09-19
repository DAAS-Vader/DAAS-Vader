module daas_vader::enclave_registry {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::{Self, String};
    use std::vector;

    /// Enclave 등록 정보
    struct EnclaveInfo has key, store {
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
    }

    /// 빌드 결과 증명
    struct BuildAttestation has key, store {
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

    /// 에러 코드
    const E_INVALID_SIGNATURE: u64 = 1;
    const E_ENCLAVE_NOT_FOUND: u64 = 2;
    const E_ENCLAVE_NOT_ACTIVE: u64 = 3;
    const E_INVALID_PCR_VALUES: u64 = 4;

    /// Enclave 등록
    public entry fun register_enclave(
        enclave_id: String,
        pcr_values: vector<vector<u8>>,
        public_key: vector<u8>,
        ctx: &mut TxContext
    ) {
        let enclave_info = EnclaveInfo {
            id: object::new(ctx),
            enclave_id,
            pcr_values,
            public_key,
            registered_at: tx_context::epoch(ctx),
            owner: tx_context::sender(ctx),
            status: ENCLAVE_STATUS_ACTIVE,
        };

        transfer::public_transfer(enclave_info, tx_context::sender(ctx));
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
        enclave_id: &String,
        signature: &vector<u8>,
        message: &vector<u8>,
        public_key: &vector<u8>
    ): bool {
        // TODO: 실제 서명 검증 로직 구현
        // AWS Nitro Enclave의 attestation 검증
        true
    }

    /// Enclave 상태 업데이트 (관리자 전용)
    public entry fun update_enclave_status(
        enclave_info: &mut EnclaveInfo,
        new_status: u8,
        ctx: &mut TxContext
    ) {
        assert!(enclave_info.owner == tx_context::sender(ctx), E_ENCLAVE_NOT_FOUND);
        enclave_info.status = new_status;
    }

    // === 조회 함수들 ===

    public fun get_enclave_status(enclave_info: &EnclaveInfo): u8 {
        enclave_info.status
    }

    public fun get_enclave_public_key(enclave_info: &EnclaveInfo): &vector<u8> {
        &enclave_info.public_key
    }

    public fun get_pcr_values(enclave_info: &EnclaveInfo): &vector<vector<u8>> {
        &enclave_info.pcr_values
    }

    public fun is_build_verified(attestation: &BuildAttestation): bool {
        attestation.verified
    }

    public fun get_image_hash(attestation: &BuildAttestation): &vector<u8> {
        &attestation.image_hash
    }
}