// 사용자와 제공자 간 작업 요청 및 매칭 컨트랙트

module daas_vader::job_requests {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    // ==================== 구조체 정의 ====================

    /// 작업 요청 정보
    public struct JobRequest has key, store {
        id: UID,
        /// 요청 고유 ID
        request_id: String,
        /// 요청자 (사용자) 주소
        requester: address,
        /// 대상 제공자 주소
        provider_address: address,
        /// 프로젝트 이름
        project_name: String,
        /// 요구사항
        requirements: JobRequirements,
        /// 예상 소요 시간 (분)
        estimated_duration: u64,
        /// 제안 가격 (SUI)
        offered_price: u64,
        /// 상태
        status: u8,
        /// 생성 시간
        created_at: u64,
        /// 업데이트 시간
        updated_at: u64,
        /// 제공자 응답 메시지
        provider_response: String,
    }

    /// 작업 요구사항
    public struct JobRequirements has store, copy, drop {
        cpu_cores: u32,
        memory_gb: u32,
        storage_gb: u32,
        bandwidth_mbps: u32,
    }

    /// 글로벌 작업 요청 레지스트리
    public struct JobRequestRegistry has key {
        id: UID,
        /// 모든 작업 요청들 (request_id -> JobRequest ID)
        requests: Table<String, ID>,
        /// 제공자별 요청 목록 (provider_address -> request_ids)
        provider_requests: Table<address, vector<String>>,
        /// 요청자별 요청 목록 (requester_address -> request_ids)
        requester_requests: Table<address, vector<String>>,
        /// 요청 카운터
        request_counter: u64,
    }

    // ==================== 상수 정의 ====================

    /// 작업 요청 상태
    const JOB_STATUS_PENDING: u8 = 1;
    const JOB_STATUS_ACCEPTED: u8 = 2;
    const JOB_STATUS_REJECTED: u8 = 3;
    const JOB_STATUS_COMPLETED: u8 = 4;
    const JOB_STATUS_CANCELLED: u8 = 5;

    /// 에러 코드
    const E_INVALID_STATUS: u64 = 1;
    const E_NOT_AUTHORIZED: u64 = 2;
    const E_REQUEST_NOT_FOUND: u64 = 3;
    const E_INVALID_PROVIDER: u64 = 4;
    const E_ALREADY_RESPONDED: u64 = 5;

    // ==================== 이벤트 ====================

    /// 새 작업 요청 생성 이벤트
    public struct JobRequestCreated has copy, drop {
        request_id: String,
        requester: address,
        provider_address: address,
        project_name: String,
        offered_price: u64,
        timestamp: u64,
    }

    /// 작업 요청 상태 업데이트 이벤트
    public struct JobRequestUpdated has copy, drop {
        request_id: String,
        old_status: u8,
        new_status: u8,
        provider_response: String,
        timestamp: u64,
    }

    /// 실시간 알림 이벤트 (제공자용)
    public struct ProviderNotification has copy, drop {
        provider_address: address,
        request_id: String,
        project_name: String,
        offered_price: u64,
        event_type: String, // "NEW_REQUEST", "REQUEST_CANCELLED" 등
        timestamp: u64,
    }

    // ==================== 초기화 ====================

    /// 레지스트리 초기화
    fun init(ctx: &mut TxContext) {
        let registry = JobRequestRegistry {
            id: object::new(ctx),
            requests: table::new(ctx),
            provider_requests: table::new(ctx),
            requester_requests: table::new(ctx),
            request_counter: 0,
        };

        transfer::share_object(registry);
    }

    // ==================== 핵심 함수들 ====================

    /// 새 작업 요청 생성
    public entry fun create_job_request(
        registry: &mut JobRequestRegistry,
        provider_address: address,
        project_name: String,
        cpu_cores: u32,
        memory_gb: u32,
        storage_gb: u32,
        bandwidth_mbps: u32,
        estimated_duration: u64,
        offered_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let requester = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // 요청 ID 생성
        registry.request_counter = registry.request_counter + 1;
        let request_id = string::utf8(b"job_");
        string::append(&mut request_id, string::utf8(vector[
            ((registry.request_counter / 1000) % 10 + 48) as u8,
            ((registry.request_counter / 100) % 10 + 48) as u8,
            ((registry.request_counter / 10) % 10 + 48) as u8,
            ((registry.request_counter % 10) + 48) as u8
        ]));

        // 요구사항 구조체 생성
        let requirements = JobRequirements {
            cpu_cores,
            memory_gb,
            storage_gb,
            bandwidth_mbps,
        };

        // 작업 요청 객체 생성
        let job_request = JobRequest {
            id: object::new(ctx),
            request_id,
            requester,
            provider_address,
            project_name,
            requirements,
            estimated_duration,
            offered_price,
            status: JOB_STATUS_PENDING,
            created_at: current_time,
            updated_at: current_time,
            provider_response: string::utf8(b""),
        };

        let job_request_id = object::id(&job_request);

        // 레지스트리에 등록
        table::add(&mut registry.requests, request_id, job_request_id);

        // 제공자별 요청 목록에 추가
        if (!table::contains(&registry.provider_requests, provider_address)) {
            table::add(&mut registry.provider_requests, provider_address, vector::empty<String>());
        };
        let provider_list = table::borrow_mut(&mut registry.provider_requests, provider_address);
        vector::push_back(provider_list, request_id);

        // 요청자별 요청 목록에 추가
        if (!table::contains(&registry.requester_requests, requester)) {
            table::add(&mut registry.requester_requests, requester, vector::empty<String>());
        };
        let requester_list = table::borrow_mut(&mut registry.requester_requests, requester);
        vector::push_back(requester_list, request_id);

        // 이벤트 발생
        event::emit(JobRequestCreated {
            request_id,
            requester,
            provider_address,
            project_name,
            offered_price,
            timestamp: current_time,
        });

        // 제공자에게 실시간 알림
        event::emit(ProviderNotification {
            provider_address,
            request_id,
            project_name,
            offered_price,
            event_type: string::utf8(b"NEW_REQUEST"),
            timestamp: current_time,
        });

        // 작업 요청을 공유 객체로 전환
        transfer::share_object(job_request);
    }

    /// 작업 요청 상태 업데이트 (제공자가 수락/거부)
    public entry fun update_request_status(
        job_request: &mut JobRequest,
        new_status: u8,
        response_message: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 제공자만 상태를 변경할 수 있음
        assert!(sender == job_request.provider_address, E_NOT_AUTHORIZED);

        // 이미 응답했는지 확인
        assert!(job_request.status == JOB_STATUS_PENDING, E_ALREADY_RESPONDED);

        // 유효한 상태인지 확인
        assert!(
            new_status == JOB_STATUS_ACCEPTED ||
            new_status == JOB_STATUS_REJECTED,
            E_INVALID_STATUS
        );

        let old_status = job_request.status;
        job_request.status = new_status;
        job_request.provider_response = response_message;
        job_request.updated_at = clock::timestamp_ms(clock);

        // 이벤트 발생
        event::emit(JobRequestUpdated {
            request_id: job_request.request_id,
            old_status,
            new_status,
            provider_response: response_message,
            timestamp: job_request.updated_at,
        });
    }

    /// 작업 완료 처리 (요청자가 호출)
    public entry fun complete_job_request(
        job_request: &mut JobRequest,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 요청자만 완료 처리할 수 있음
        assert!(sender == job_request.requester, E_NOT_AUTHORIZED);

        // 수락된 상태에서만 완료 가능
        assert!(job_request.status == JOB_STATUS_ACCEPTED, E_INVALID_STATUS);

        let old_status = job_request.status;
        job_request.status = JOB_STATUS_COMPLETED;
        job_request.updated_at = clock::timestamp_ms(clock);

        // 이벤트 발생
        event::emit(JobRequestUpdated {
            request_id: job_request.request_id,
            old_status,
            new_status: JOB_STATUS_COMPLETED,
            provider_response: string::utf8(b"Job completed by requester"),
            timestamp: job_request.updated_at,
        });
    }

    /// 작업 요청 취소 (요청자가 호출)
    public entry fun cancel_job_request(
        job_request: &mut JobRequest,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 요청자만 취소할 수 있음
        assert!(sender == job_request.requester, E_NOT_AUTHORIZED);

        // 대기 중이거나 수락된 상태에서만 취소 가능
        assert!(
            job_request.status == JOB_STATUS_PENDING ||
            job_request.status == JOB_STATUS_ACCEPTED,
            E_INVALID_STATUS
        );

        let old_status = job_request.status;
        job_request.status = JOB_STATUS_CANCELLED;
        job_request.updated_at = clock::timestamp_ms(clock);

        // 제공자에게 취소 알림
        event::emit(ProviderNotification {
            provider_address: job_request.provider_address,
            request_id: job_request.request_id,
            project_name: job_request.project_name,
            offered_price: job_request.offered_price,
            event_type: string::utf8(b"REQUEST_CANCELLED"),
            timestamp: job_request.updated_at,
        });

        // 이벤트 발생
        event::emit(JobRequestUpdated {
            request_id: job_request.request_id,
            old_status,
            new_status: JOB_STATUS_CANCELLED,
            provider_response: string::utf8(b"Request cancelled by requester"),
            timestamp: job_request.updated_at,
        });
    }

    // ==================== 조회 함수들 ====================

    /// 제공자의 요청 목록 조회
    public fun get_provider_requests(
        registry: &JobRequestRegistry,
        provider_address: address
    ): vector<String> {
        if (table::contains(&registry.provider_requests, provider_address)) {
            *table::borrow(&registry.provider_requests, provider_address)
        } else {
            vector::empty<String>()
        }
    }

    /// 요청자의 요청 목록 조회 (활성 작업 확인용)
    public fun get_requester_requests(
        registry: &JobRequestRegistry,
        requester_address: address
    ): vector<String> {
        if (table::contains(&registry.requester_requests, requester_address)) {
            *table::borrow(&registry.requester_requests, requester_address)
        } else {
            vector::empty<String>()
        }
    }

    /// 특정 작업 요청 정보 조회
    public fun get_request_info(job_request: &JobRequest): (
        String,     // request_id
        address,    // requester
        address,    // provider_address
        String,     // project_name
        u64,        // offered_price
        u8,         // status
        u64,        // created_at
        String      // provider_response
    ) {
        (
            job_request.request_id,
            job_request.requester,
            job_request.provider_address,
            job_request.project_name,
            job_request.offered_price,
            job_request.status,
            job_request.created_at,
            job_request.provider_response
        )
    }

    /// 작업 요구사항 조회
    public fun get_job_requirements(job_request: &JobRequest): (u32, u32, u32, u32) {
        let req = &job_request.requirements;
        (req.cpu_cores, req.memory_gb, req.storage_gb, req.bandwidth_mbps)
    }

    /// 작업 요청 상태 확인
    public fun get_request_status(job_request: &JobRequest): u8 {
        job_request.status
    }

    /// 요청 ID로 작업 요청 존재 여부 확인
    public fun request_exists(
        registry: &JobRequestRegistry,
        request_id: String
    ): bool {
        table::contains(&registry.requests, request_id)
    }

    // ==================== 유틸리티 함수들 ====================

    /// 상태 상수 조회
    public fun get_status_pending(): u8 { JOB_STATUS_PENDING }
    public fun get_status_accepted(): u8 { JOB_STATUS_ACCEPTED }
    public fun get_status_rejected(): u8 { JOB_STATUS_REJECTED }
    public fun get_status_completed(): u8 { JOB_STATUS_COMPLETED }
    public fun get_status_cancelled(): u8 { JOB_STATUS_CANCELLED }

    /// 총 요청 수 조회
    public fun get_total_requests(registry: &JobRequestRegistry): u64 {
        registry.request_counter
    }
}