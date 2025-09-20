module daas_vader::docker_registry;

use std::string::{Self, String};
use sui::clock::{Self, Clock};
use sui::event;
use sui::table::{Self, Table};

/// Docker 이미지 레지스트리
public struct DockerRegistry has key {
    id: UID,
    images: Table<address, vector<DockerImage>>,
    all_images: vector<DockerImage>, // 전체 이미지 목록 (조회용)
    total_images: u64,
}

/// Docker 이미지 정보
public struct DockerImage has copy, drop, store {
    download_urls: vector<String>, // URL pool (여러 다운로드 소스)
    primary_url_index: u64, // 기본 URL 인덱스
    image_name: String,
    size: u64,
    timestamp: u64,
    upload_type: String, // "docker" or "project"
}

/// 이미지 등록 이벤트
public struct ImageRegisteredEvent has copy, drop {
    owner: address,
    urls: vector<String>,
    image_name: String,
    timestamp: u64,
}

/// 이미지 삭제 이벤트
#[allow(unused_field)]
public struct ImageDeleted has copy, drop {
    owner: address,
    image_name: String,
}

/// 레지스트리 초기화 (한 번만 실행)
fun init(ctx: &mut TxContext) {
    let registry = DockerRegistry {
        id: object::new(ctx),
        images: table::new(ctx),
        all_images: vector::empty(),
        total_images: 0,
    };
    transfer::share_object(registry);
}

/// Docker 이미지 등록 (여러 URL 지원)
public fun register_docker_image(
    registry: &mut DockerRegistry,
    download_urls: vector<String>,
    image_name: String,
    size: u64,
    upload_type: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let timestamp = clock::timestamp_ms(clock);

    // URL 유효성 검사
    assert!(vector::length(&download_urls) > 0, 0); // 최소 하나의 URL 필요
    assert!(string::length(&image_name) > 0, 1);

    // 모든 URL이 유효한지 확인
    let mut i = 0;
    while (i < vector::length(&download_urls)) {
        assert!(string::length(vector::borrow(&download_urls, i)) > 0, 2);
        i = i + 1;
    };

    let docker_image = DockerImage {
        download_urls,
        primary_url_index: 0, // 첫 번째 URL을 기본으로 설정
        image_name,
        size,
        timestamp,
        upload_type,
    };

    // 사용자별 이미지 목록에 추가
    if (!table::contains(&registry.images, sender)) {
        table::add(&mut registry.images, sender, vector::empty());
    };
    let user_images = table::borrow_mut(&mut registry.images, sender);
    vector::push_back(user_images, docker_image);

    // 전체 이미지 목록에도 추가
    vector::push_back(&mut registry.all_images, docker_image);

    registry.total_images = registry.total_images + 1;

    // 이벤트 발생
    event::emit(ImageRegisteredEvent {
        owner: sender,
        urls: download_urls,
        image_name,
        timestamp,
    });
}

/// 사용자의 이미지 목록 조회
public fun get_user_images(registry: &DockerRegistry, user: address): vector<DockerImage> {
    if (table::contains(&registry.images, user)) {
        *table::borrow(&registry.images, user)
    } else {
        vector::empty()
    }
}

/// 전체 이미지 수 조회
public fun get_total_images(registry: &DockerRegistry): u64 {
    registry.total_images
}

/// 모든 사용자의 이미지 목록 조회 (전체 레지스트리)
public fun get_all_images(registry: &DockerRegistry): vector<DockerImage> {
    registry.all_images
}

// 테스트 전용 초기화 함수
#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
