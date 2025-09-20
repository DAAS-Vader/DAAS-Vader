const { SuiClient } = require('@mysten/sui/client');

const PACKAGE_ID = '0xf59bd1a3d4a0d26fa84d9d1c6cceb69063347f7ff2ee3a381115af6057cb30d2';

async function findRegistryObject() {
  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

  try {
    console.log('🔍 패키지 정보 조회 중...');

    // 패키지의 트랜잭션 히스토리 조회
    const txs = await client.queryTransactionBlocks({
      filter: {
        FromAddress: PACKAGE_ID
      },
      options: {
        showEvents: true,
        showObjectChanges: true
      }
    });

    console.log(`📦 트랜잭션 수: ${txs.data.length}`);

    // 패키지 publish 트랜잭션 찾기
    const publishTx = await client.queryTransactionBlocks({
      filter: {
        InputObject: PACKAGE_ID
      },
      options: {
        showEvents: true,
        showObjectChanges: true
      }
    });

    // Created objects 찾기
    for (const tx of publishTx.data) {
      if (tx.objectChanges) {
        for (const change of tx.objectChanges) {
          if (change.type === 'created' && change.objectType?.includes('DockerRegistry')) {
            console.log('\n✅ Registry 객체를 찾았습니다!');
            console.log('Object ID:', change.objectId);
            console.log('Type:', change.objectType);
            return change.objectId;
          }
        }
      }
    }

    // 다른 방법: 모든 shared objects 조회
    console.log('\n🔍 Shared 객체 검색 중...');

    // 최근 트랜잭션에서 created objects 찾기
    const recentTxs = await client.queryTransactionBlocks({
      limit: 100,
      options: {
        showObjectChanges: true
      }
    });

    for (const tx of recentTxs.data) {
      if (tx.objectChanges) {
        for (const change of tx.objectChanges) {
          if (change.objectType?.includes(PACKAGE_ID) && change.objectType?.includes('DockerRegistry')) {
            console.log('\n✅ Registry 객체를 찾았습니다!');
            console.log('Object ID:', change.objectId);
            console.log('Type:', change.objectType);

            // 객체 상태 확인
            const obj = await client.getObject({
              id: change.objectId,
              options: {
                showContent: true,
                showOwner: true
              }
            });

            if (obj.data) {
              console.log('Owner:', obj.data.owner);
              console.log('Content:', JSON.stringify(obj.data.content, null, 2));
            }

            return change.objectId;
          }
        }
      }
    }

    console.log('❌ Registry 객체를 찾을 수 없습니다.');
    console.log('패키지가 배포되었는지 확인하고, init 함수가 실행되었는지 확인해주세요.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// 실행
findRegistryObject().then(registryId => {
  if (registryId) {
    console.log('\n📝 다음 값을 docker-registry.ts 파일에 업데이트하세요:');
    console.log(`export const REGISTRY_ID = '${registryId}';`);
  }
});