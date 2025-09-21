import { SuiClient } from '@mysten/sui/client'
import { REGISTRY_ID } from '@/lib/docker-registry'

export async function testRegistryConnection() {
  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' })

  try {
    console.log('🧪 Testing registry connection...')
    console.log('📋 Registry ID:', REGISTRY_ID)

    const result = await client.getObject({
      id: REGISTRY_ID,
      options: {
        showContent: true,
        showType: true,
      },
    })

    console.log('📄 Registry object:', result)

    if (result.data?.content?.dataType === 'moveObject') {
      const fields = (result.data.content as { fields: Record<string, unknown> }).fields
      console.log('📊 Registry fields:', fields)
      console.log('📊 Total images:', fields.total_images)
      console.log('📦 All images:', fields.all_images)

      return {
        success: true,
        totalImages: parseInt(fields.total_images?.toString() || '0'),
        allImages: fields.all_images
      }
    }

    return { success: false, error: 'Not a move object' }
  } catch (error) {
    console.error('❌ Registry test failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Call this function in browser console to test
if (typeof window !== 'undefined') {
  (window as any).testRegistry = testRegistryConnection
}