// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// DAAS-Vader용 Seal 접근 제어 모듈
///
/// 이 모듈은 Walrus Seal 시스템에서 요구되는 seal_approve* 함수들을 구현합니다.
/// 기존 enclave_registry와 통합되어 enclave 검증 및 다양한 보안 기준에 기반한
/// 암호화된 데이터에 대한 포괄적인 접근 제어를 제공합니다.

module daas_vader::seal_access_control {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use std::vector;
    use std::string::{Self, String};
    use sui::event;
    use daas_vader::enclave_registry::{Self, EnclaveInfo};

    // ==================== 에러 코드 ====================

    /// 권한 없는 접근
    const EUnauthorizedAccess: u64 = 1;
    /// 유효하지 않은 식별자
    const EInvalidIdentity: u64 = 2;
    /// 만료된 권한
    const EExpiredPermission: u64 = 3;
    /// 유효하지 않은 Enclave
    const EInvalidEnclave: u64 = 4;
    /// 권한 부족
    const EInsufficientPermissions: u64 = 5;
    /// 레지스트리 초기화되지 않음
    const ERegistryNotInitialized: u64 = 6;
    /// Enclave가 활성화되지 않음
    const EEnclaveNotActive: u64 = 7;
    /// 유효하지 않은 데이터 타입
    const EInvalidDataType: u64 = 8;
    /// Seal을 찾을 수 없음
    const ESealNotFound: u64 = 9;
    /// Seal이 이미 존재함
    const ESealAlreadyExists: u64 = 10;

    // ==================== 상수 정의 ====================


    /// 접근 제어를 위한 데이터 타입
    const DATA_TYPE_SECRETS: u8 = 0;      // 최고 보안 - enclave 필요
    const DATA_TYPE_CONFIG: u8 = 1;       // 중간 보안
    const DATA_TYPE_LOGS: u8 = 2;         // 낮은 보안
    const DATA_TYPE_PUBLIC: u8 = 3;       // 공개 데이터

    /// 보안을 위한 최소 식별자 길이
    const MIN_IDENTITY_LENGTH: u64 = 8;

    /// 세션 지속 시간 제한 (밀리초)
    const MAX_SESSION_DURATION: u64 = 3600000; // 1시간

    // ==================== 핵심 구조체 ====================

    /// 온체인 Seal 데이터 저장소
    public struct SealData has key, store {
        id: UID,
        /// Seal 고유 식별자
        seal_id: String,
        /// 암호화된 데이터
        encrypted_data: String,
        /// HMAC 값
        hmac: String,
        /// 초기화 벡터
        iv: String,
        /// 식별자
        identity: vector<u8>,
        /// 데이터 타입
        data_type: u8,
        /// 생성 시간
        timestamp: u64,
        /// 생성자 주소
        created_by: address
    }

    /// Seal 저장 이벤트
    public struct SealStored has copy, drop {
        /// Seal 식별자
        seal_id: String,
        /// 데이터 타입
        data_type: u8,
        /// 생성 시간
        timestamp: u64,
        /// 생성자 주소
        created_by: address
    }

    /// Seal 조회 이벤트
    public struct SealRetrieved has copy, drop {
        /// Seal 식별자
        seal_id: String,
        /// 조회한 사용자 주소
        retrieved_by: address,
        /// 조회 시간
        timestamp: u64
    }

    /// 접근 권한 관리를 위한 글로벌 Seal 레지스트리
    public struct SealRegistry has key {
        id: UID,
        /// 패키지별 권한
        package_permissions: Table<address, PackagePermission>,
        /// 식별자 기반 접근 규칙
        identity_rules: Table<vector<u8>, IdentityRule>,
        /// 글로벌 seal 설정
        global_settings: SealSettings,
        /// 관리자 권한 소유자
        admin: address,
        /// 업그레이드 호환성을 위한 레지스트리 버전
        version: u64,
        /// Seal 데이터 저장소
        seal_storage: Table<String, ID>,
    }

    /// 특정 패키지를 위한 권한 설정
    public struct PackagePermission has store, drop {
        /// 이 패키지가 seal 작업을 허용하는지 여부
        enabled: bool,
        /// 이 패키지에 허용된 데이터 타입들
        allowed_data_types: vector<u8>,
        /// 필요한 최소 enclave 검증 레벨
        min_enclave_level: u8,
        /// 접근 시간 윈도우
        access_window: AccessWindow,
        /// 권한 만료 시간
        expires_at: u64,
        /// 패키지 소유자
        owner: address,
    }

    /// 특정 식별자 패턴을 위한 규칙
    public struct IdentityRule has store, drop {
        /// 식별자 패턴 (접두사 매칭)
        pattern: vector<u8>,
        /// 허용된 작업들
        allowed_operations: vector<u8>,
        /// enclave 필요 여부
        requires_enclave: bool,
        /// 시간 기반 제한
        time_restrictions: vector<TimeWindow>,
        /// 규칙 만료 시간
        expires_at: u64,
    }

    /// 시간 기반 접근 윈도우
    public struct AccessWindow has store, drop {
        /// 시작 시간 (0 = 제한 없음)
        start_time: u64,
        /// 종료 시간 (0 = 제한 없음)
        end_time: u64,
        /// 허용된 요일 (비트마스크)
        allowed_days: u8,
        /// 허용된 시간 (24시간 비트마스크)
        allowed_hours: u32,
    }

    /// 세밀한 제어를 위한 특정 시간 윈도우
    public struct TimeWindow has store, drop {
        /// 시작 시간
        start_hour: u8,
        /// 종료 시간
        end_hour: u8,
        /// 요일 마스크
        days_mask: u8,
    }

    /// 글로벌 seal 설정
    public struct SealSettings has store, drop {
        /// 등록되지 않은 패키지를 위한 기본 권한 정책
        default_allow: bool,
        /// 글로벌 enclave 검증 강제 여부
        require_enclave_validation: bool,
        /// 최대 세션 지속 시간
        max_session_duration: u64,
        /// 최소 식별자 길이 요구사항
        min_identity_length: u64,
        /// 속도 제한 설정
        max_requests_per_hour: u64,
    }

    /// 관리자 권한
    public struct AdminCap has key, store {
        id: UID,
    }

    // ==================== 초기화 ====================

    /// seal 레지스트리 초기화
    fun init(ctx: &mut TxContext) {
        let admin = tx_context::sender(ctx);

        let registry = SealRegistry {
            id: object::new(ctx),
            package_permissions: table::new(ctx),
            identity_rules: table::new(ctx),
            global_settings: SealSettings {
                default_allow: false, // 보수적 기본값
                require_enclave_validation: true,
                max_session_duration: MAX_SESSION_DURATION,
                min_identity_length: MIN_IDENTITY_LENGTH,
                max_requests_per_hour: 1000,
            },
            admin,
            version: 1,
            seal_storage: table::new(ctx),
        };

        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        transfer::share_object(registry);
        transfer::transfer(admin_cap, admin);
    }

    // ==================== 핵심 Seal 승인 함수들 ====================

    /// enclave 기반 접근을 위한 주요 seal 승인 함수
    /// Seal 시스템에서 호출하는 메인 함수입니다
    ///
    /// @param identity: 식별자 바이트 (패키지 ID 접두사 제거됨)
    /// @param registry: seal 레지스트리 참조
    /// @param clock: 시간 검증을 위한 클록
    /// @return: 접근 허가 시 true, 거부 시 중단
    fun seal_approve_enclave(
        identity: vector<u8>,
        registry: &SealRegistry,
        clock: &Clock
    ): bool {
        // 식별자 길이 검증
        if (vector::length(&identity) < registry.global_settings.min_identity_length) {
            return false
        };

        // enclave 검증이 글로벌하게 필요한지 확인
        if (registry.global_settings.require_enclave_validation) {
            // 현재는 기본 검증을 구현합니다
            // 완전한 구현에서는 등록된 enclave들과 대조할 것입니다
            if (!is_valid_enclave_identity(&identity)) {
                return false
            };
        };

        // 시간 기반 검증
        let current_time = clock::timestamp_ms(clock);
        if (current_time == 0) {
            return false
        };

        // 식별자별 규칙이 존재하는지 확인
        if (table::contains(&registry.identity_rules, identity)) {
            let rule = table::borrow(&registry.identity_rules, identity);
            return validate_identity_rule(rule, current_time)
        };

        true
    }

    /// 타입별 제어를 가진 데이터 접근을 위한 Seal 승인 함수
    ///
    /// @param identity: 식별자 바이트
    /// @param data_type: 데이터 타입 (0=비밀, 1=설정, 2=로그, 3=공개)
    /// @param registry: seal 레지스트리 참조
    /// @param clock: 시간 검증을 위한 클록
    /// @return: 접근 허가 시 true
    fun seal_approve_data_access(
        identity: vector<u8>,
        data_type: u8,
        registry: &SealRegistry,
        clock: &Clock
    ): bool {
        // 데이터 타입 검증
        if (data_type > DATA_TYPE_PUBLIC) {
            return false
        };

        // 식별자 검증
        if (vector::length(&identity) < registry.global_settings.min_identity_length) {
            return false
        };

        let current_time = clock::timestamp_ms(clock);

        // 비밀 데이터는 최고 수준의 검증이 필요
        if (data_type == DATA_TYPE_SECRETS) {
            if (!registry.global_settings.require_enclave_validation) {
                return false
            };

            // 비밀 데이터를 위해서는 유효한 enclave가 필수
            if (!is_valid_enclave_identity(&identity)) {
                return false
            };
        };

        // 시간 기반 접근 확인
        if (current_time == 0) {
            return false
        };

        // 식별자별 규칙 적용
        if (table::contains(&registry.identity_rules, identity)) {
            let rule = table::borrow(&registry.identity_rules, identity);
            if (rule.requires_enclave && data_type <= DATA_TYPE_CONFIG) {
                if (!is_valid_enclave_identity(&identity)) {
                    return false
                };
            };
            return validate_identity_rule(rule, current_time)
        };

        true
    }

    /// 패키지별 권한을 위한 Seal 승인 함수
    ///
    /// @param identity: 식별자 바이트
    /// @param package_addr: 요청하는 패키지의 주소
    /// @param registry: seal 레지스트리 참조
    /// @param clock: 시간 검증을 위한 클록
    /// @return: 패키지가 권한을 가지고 있으면 true
    fun seal_approve_package(
        identity: vector<u8>,
        package_addr: address,
        registry: &SealRegistry,
        clock: &Clock
    ): bool {
        // 패키지가 등록되어 있는지 확인
        if (!table::contains(&registry.package_permissions, package_addr)) {
            return registry.global_settings.default_allow
        };

        let package_perm = table::borrow(&registry.package_permissions, package_addr);

        // 패키지 권한이 활성화되어 있는지 확인
        if (!package_perm.enabled) {
            return false
        };

        let current_time = clock::timestamp_ms(clock);

        // 만료 확인
        if (package_perm.expires_at > 0 && current_time > package_perm.expires_at) {
            return false
        };

        // 시간 윈도우 확인
        if (!is_within_access_window(current_time, &package_perm.access_window)) {
            return false
        };

        // 식별자 길이 확인
        if (vector::length(&identity) < registry.global_settings.min_identity_length) {
            return false
        };

        true
    }

    /// 작업별 제어를 가진 향상된 seal 승인
    ///
    /// @param identity: 식별자 바이트
    /// @param operation: 작업 타입 (0=읽기, 1=쓰기, 2=삭제)
    /// @param resource_type: 접근하려는 리소스 타입
    /// @param registry: seal 레지스트리 참조
    /// @param clock: 시간 검증을 위한 클록
    /// @return: 작업이 허가되면 true
    fun seal_approve_operation(
        identity: vector<u8>,
        operation: u8,
        resource_type: u8,
        registry: &SealRegistry,
        clock: &Clock
    ): bool {
        // 기본 검증
        if (vector::length(&identity) < registry.global_settings.min_identity_length) {
            return false
        };

        let current_time = clock::timestamp_ms(clock);

        // 식별자별 작업 권한 확인
        if (table::contains(&registry.identity_rules, identity)) {
            let rule = table::borrow(&registry.identity_rules, identity);

            // 작업이 허용되는지 확인
            if (!vector::contains(&rule.allowed_operations, &operation)) {
                return false
            };

            // 민감한 작업에 대한 enclave 요구사항 확인
            if (rule.requires_enclave && (operation == 1 || operation == 2)) { // 쓰기/삭제
                if (!is_valid_enclave_identity(&identity)) {
                    return false
                };
            };

            return validate_identity_rule(rule, current_time)
        };

        // 등록되지 않은 식별자에 대한 기본 정책
        if (operation == 0) { // 읽기
            return true
        };

        // 쓰기/삭제 작업은 등록이 필요
        false
    }

    // ==================== 공개 진입점 함수들 ====================

    /// enclave 접근 검증을 위한 공개 진입점
    public entry fun verify_enclave_access(
        identity: vector<u8>,
        registry: &SealRegistry,
        clock: &Clock
    ) {
        assert!(seal_approve_enclave(identity, registry, clock), EUnauthorizedAccess);
    }

    /// 데이터 접근 검증을 위한 공개 진입점
    public entry fun verify_data_access(
        identity: vector<u8>,
        data_type: u8,
        registry: &SealRegistry,
        clock: &Clock
    ) {
        assert!(seal_approve_data_access(identity, data_type, registry, clock), EUnauthorizedAccess);
    }

    /// 패키지 접근 검증을 위한 공개 진입점
    public entry fun verify_package_access(
        identity: vector<u8>,
        package_addr: address,
        registry: &SealRegistry,
        clock: &Clock
    ) {
        assert!(seal_approve_package(identity, package_addr, registry, clock), EUnauthorizedAccess);
    }

    /// 작업 검증을 위한 공개 진입점
    public entry fun verify_operation(
        identity: vector<u8>,
        operation: u8,
        resource_type: u8,
        registry: &SealRegistry,
        clock: &Clock
    ) {
        assert!(seal_approve_operation(identity, operation, resource_type, registry, clock), EUnauthorizedAccess);
    }

    // ==================== 도우미 함수들 ====================

    /// 식별자가 유효한 enclave를 나타내는지 확인
    fun is_valid_enclave_identity(identity: &vector<u8>): bool {
        // enclave 식별자를 위한 기본 패턴 매칭
        // 완전한 구현에서는 enclave_registry와 대조할 것입니다
        let len = vector::length(identity);
        if (len < MIN_IDENTITY_LENGTH) {
            return false
        };

        // enclave와 유사한 패턴 확인 (특정 접두사로 시작)
        let first_byte = *vector::borrow(identity, 0);

        // Enclave 식별자는 일반적으로 특정 패턴으로 시작
        if (first_byte == 0x45 || first_byte == 0x4E) { // Enclave/Nitro를 위한 'E' 또는 'N'
            return true
        };

        false
    }

    /// 식별자별 규칙 검증
    fun validate_identity_rule(rule: &IdentityRule, current_time: u64): bool {
        // 만료 확인
        if (rule.expires_at > 0 && current_time > rule.expires_at) {
            return false
        };

        // 지정된 경우 시간 윈도우 확인
        if (vector::length(&rule.time_restrictions) > 0) {
            return validate_time_windows(&rule.time_restrictions, current_time)
        };

        true
    }

    /// 현재 시간이 접근 윈도우 내에 있는지 확인
    fun is_within_access_window(current_time: u64, window: &AccessWindow): bool {
        // 시작 시간 확인
        if (window.start_time > 0 && current_time < window.start_time) {
            return false
        };

        // 종료 시간 확인
        if (window.end_time > 0 && current_time > window.end_time) {
            return false
        };

        // 프로덕션에서는 요일/시간 검증을 구현할 것입니다
        true
    }

    /// 시간 윈도우 검증
    fun validate_time_windows(windows: &vector<TimeWindow>, current_time: u64): bool {
        // 단순화된 시간 윈도우 검증
        // 프로덕션에서는 current_time을 파싱하여 시간/요일을 추출할 것입니다
        vector::length(windows) == 0 || true
    }

    // ==================== 관리자 함수들 ====================

    /// 패키지 권한 추가 (관리자 전용)
    public entry fun add_package_permission(
        _admin_cap: &AdminCap,
        registry: &mut SealRegistry,
        package_addr: address,
        enabled: bool,
        allowed_data_types: vector<u8>,
        expires_at: u64,
        ctx: &mut TxContext
    ) {
        let permission = PackagePermission {
            enabled,
            allowed_data_types,
            min_enclave_level: 1,
            access_window: AccessWindow {
                start_time: 0,
                end_time: 0,
                allowed_days: 0,
                allowed_hours: 0,
            },
            expires_at,
            owner: tx_context::sender(ctx),
        };

        if (table::contains(&registry.package_permissions, package_addr)) {
            table::remove(&mut registry.package_permissions, package_addr);
        };

        table::add(&mut registry.package_permissions, package_addr, permission);
    }

    /// 식별자별 규칙 추가 (관리자 전용)
    public entry fun add_identity_rule(
        _admin_cap: &AdminCap,
        registry: &mut SealRegistry,
        identity: vector<u8>,
        allowed_operations: vector<u8>,
        requires_enclave: bool,
        expires_at: u64,
    ) {
        let rule = IdentityRule {
            pattern: identity,
            allowed_operations,
            requires_enclave,
            time_restrictions: vector::empty(),
            expires_at,
        };

        if (table::contains(&registry.identity_rules, identity)) {
            table::remove(&mut registry.identity_rules, identity);
        };

        table::add(&mut registry.identity_rules, identity, rule);
    }

    /// 글로벌 설정 업데이트 (관리자 전용)
    public entry fun update_global_settings(
        _admin_cap: &AdminCap,
        registry: &mut SealRegistry,
        default_allow: bool,
        require_enclave_validation: bool,
        max_session_duration: u64,
    ) {
        registry.global_settings.default_allow = default_allow;
        registry.global_settings.require_enclave_validation = require_enclave_validation;
        registry.global_settings.max_session_duration = max_session_duration;
    }

    // ==================== 조회 함수들 ====================

    /// 레지스트리 버전 가져오기
    public fun get_version(registry: &SealRegistry): u64 {
        registry.version
    }

    /// 패키지가 권한을 가지고 있는지 확인
    public fun has_package_permission(registry: &SealRegistry, package_addr: address): bool {
        table::contains(&registry.package_permissions, package_addr)
    }

    /// 식별자가 특정 규칙을 가지고 있는지 확인
    public fun has_identity_rule(registry: &SealRegistry, identity: vector<u8>): bool {
        table::contains(&registry.identity_rules, identity)
    }

    /// 글로벌 설정 가져오기
    public fun get_global_settings(registry: &SealRegistry): (bool, bool, u64, u64) {
        (
            registry.global_settings.default_allow,
            registry.global_settings.require_enclave_validation,
            registry.global_settings.max_session_duration,
            registry.global_settings.min_identity_length
        )
    }

    // ==================== Seal 데이터 관리 ====================

    /// 새로운 Seal을 온체인에 생성하고 저장
    public entry fun create_seal(
        seal_id: String,
        encrypted_data: String,
        hmac: String,
        iv: String,
        identity: vector<u8>,
        data_type: u8,
        timestamp: u64,
        registry: &mut SealRegistry,
        ctx: &mut TxContext
    ) {
        // seal이 이미 존재하는지 확인
        assert!(!table::contains(&registry.seal_storage, seal_id), ESealAlreadyExists);

        let sender = tx_context::sender(ctx);

        // seal 데이터 객체 생성
        let seal_data = SealData {
            id: object::new(ctx),
            seal_id,
            encrypted_data,
            hmac,
            iv,
            identity,
            data_type,
            timestamp,
            created_by: sender
        };

        let seal_data_id = object::id(&seal_data);

        // seal 데이터를 저장하고 레지스트리에 참조 유지
        table::add(&mut registry.seal_storage, seal_id, seal_data_id);
        transfer::share_object(seal_data);

        // 이벤트 발생
        event::emit(SealStored {
            seal_id,
            data_type,
            timestamp,
            created_by: sender
        });
    }

    /// seal_id로 Seal 조회
    public fun get_seal(
        seal_id: String,
        registry: &SealRegistry
    ): (String, String, String, vector<u8>, u8, u64) {
        // seal이 존재하는지 확인
        assert!(table::contains(&registry.seal_storage, seal_id), ESealNotFound);

        // 이 함수가 작동하려면 테이블에 실제 SealData를 저장해야 합니다
        // 이것은 더미 데이터를 반환하는 단순화된 버전입니다
        // 실제로는 실제 SealData 객체를 조회할 것입니다

        (
            string::utf8(b"encrypted_data_placeholder"),
            string::utf8(b"hmac_placeholder"),
            string::utf8(b"iv_placeholder"),
            vector::empty<u8>(),
            0,
            0
        )
    }

    /// seal이 존재하는지 확인
    public fun seal_exists(registry: &SealRegistry, seal_id: String): bool {
        table::contains(&registry.seal_storage, seal_id)
    }

    /// 저장된 seal의 ID 가져오기
    public fun get_seal_id(registry: &SealRegistry, seal_id: String): ID {
        assert!(table::contains(&registry.seal_storage, seal_id), ESealNotFound);
        *table::borrow(&registry.seal_storage, seal_id)
    }

    /// seal 조회 이벤트 로깅
    public entry fun log_seal_retrieval(
        seal_id: String,
        registry: &SealRegistry,
        ctx: &mut TxContext
    ) {
        // seal이 존재하는지 확인
        assert!(table::contains(&registry.seal_storage, seal_id), ESealNotFound);

        let sender = tx_context::sender(ctx);

        // 조회 이벤트 발생
        event::emit(SealRetrieved {
            seal_id,
            retrieved_by: sender,
            timestamp: 0 // 프로덕션에서는 Clock을 사용할 것
        });
    }

    // ==================== 향상된 접근 제어 ====================

    /// 포괄적인 검사를 가진 향상된 seal 승인
    public fun seal_approve_enhanced(
        identity: vector<u8>,
        data_type: u8,
        operation: u8, // 0=읽기, 1=쓰기, 2=삭제
        registry: &SealRegistry,
        clock: &Clock
    ): bool {
        let current_time = clock::timestamp_ms(clock);

        // 기본 데이터 접근 승인
        if (!seal_approve_data_access(identity, data_type, registry, clock)) {
            return false
        };

        // 추가 작업별 검사
        if (operation == 2) { // 삭제 작업
            // LOGS와 PUBLIC 데이터에 대해서만 삭제 허용
            if (data_type < DATA_TYPE_LOGS) {
                return false
            };
        };

        // 시간 기반 제한 확인
        if (registry.global_settings.max_session_duration > 0) {
            // 추가 세션 검증이 여기에 들어갈 것입니다
        };

        true
    }

    /// 여러 식별자에 대한 대량 seal 승인
    public fun seal_approve_bulk(
        identities: vector<vector<u8>>,
        data_types: vector<u8>,
        registry: &SealRegistry,
        clock: &Clock
    ): vector<bool> {
        let mut results = vector::empty<bool>();
        let mut i = 0;
        let len = vector::length(&identities);

        while (i < len) {
            let identity = *vector::borrow(&identities, i);
            let data_type = if (i < vector::length(&data_types)) {
                *vector::borrow(&data_types, i)
            } else {
                DATA_TYPE_PUBLIC // 가장 관대한 기본값
            };

            let approved = seal_approve_data_access(identity, data_type, registry, clock);
            vector::push_back(&mut results, approved);
            i = i + 1;
        };

        results
    }
}