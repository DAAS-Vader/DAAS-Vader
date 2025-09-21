import { SuiClient } from '@mysten/sui/client'
import { Task } from '@/types'
import { DockerRegistryClient, REGISTRY_ID } from '@/lib/docker-registry'

export interface DockerImage {
  download_urls: string[]
  primary_url_index: number
  image_name: string
  size: number
  timestamp: number
  upload_type: string
  requirements: {
    min_cpu_cores: number
    min_memory_gb: number
    min_storage_gb: number
    max_price_per_hour: number
  }
}

export class DockerRegistryAdapter {
  private client: DockerRegistryClient
  private suiClient: SuiClient

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient
    this.client = new DockerRegistryClient(suiClient)
  }

  /**
   * Get all Docker images from the registry
   */
  async getAllImages(): Promise<DockerImage[]> {
    try {
      console.log('🔗 Connecting to Sui RPC...')
      console.log('📋 Registry ID:', REGISTRY_ID)

      // Get the registry object directly to access all_images field
      const result = await this.suiClient.getObject({
        id: REGISTRY_ID,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (result.data?.content?.dataType === 'moveObject') {
        const fields = (result.data.content as { fields: Record<string, unknown> }).fields
        const allImages = fields.all_images as any[]

        if (Array.isArray(allImages)) {
          console.log('🔍 Parsing', allImages.length, 'images from registry')
          return allImages.map(image => ({
            download_urls: image.download_urls || [],
            primary_url_index: parseInt(image.primary_url_index?.toString()) || 0,
            image_name: image.image_name || '',
            size: parseInt(image.size?.toString()) || 0,
            timestamp: parseInt(image.timestamp?.toString()) || Date.now(),
            upload_type: image.upload_type || 'docker',
            requirements: {
              min_cpu_cores: parseInt(image.requirements?.min_cpu_cores?.toString()) || 1,
              min_memory_gb: parseInt(image.requirements?.min_memory_gb?.toString()) || 1,
              min_storage_gb: parseInt(image.requirements?.min_storage_gb?.toString()) || 1,
              max_price_per_hour: parseInt(image.requirements?.max_price_per_hour?.toString()) || 1000000
            }
          }))
        }
      }

      console.log('⚠️ No images found in registry structure')
      return []
    } catch (error) {
      console.error('❌ Failed to fetch images from registry:', error)
      return []
    }
  }

  /**
   * Convert DockerImage to Task format for the UI
   */
  convertToTasks(images: DockerImage[]): Task[] {
    return images.map((image, index) => ({
      id: `registry-${index}`,
      name: image.image_name,
      description: `Deploy ${image.image_name} (${image.upload_type})`,
      walrusBlobUrl: image.download_urls[image.primary_url_index] || image.download_urls[0],
      requiredResources: {
        cpu: image.requirements.min_cpu_cores,
        memory: image.requirements.min_memory_gb,
        storage: image.requirements.min_storage_gb
      },
      reward: Math.floor(image.requirements.max_price_per_hour / 1000000), // Convert from MIST to SUI
      deadline: new Date(image.timestamp + 7 * 24 * 60 * 60 * 1000), // 7 days from upload
      status: 'available',
      createdBy: '0x0000...0000', // Would need to be tracked separately
      createdAt: new Date(image.timestamp),
      estimatedDuration: this.estimateTaskDuration(image),
      tags: this.generateTags(image)
    }))
  }

  /**
   * Estimate task duration based on image properties
   */
  private estimateTaskDuration(image: DockerImage): number {
    const baseHours = 24
    const cpuMultiplier = image.requirements.min_cpu_cores * 2
    const memoryMultiplier = image.requirements.min_memory_gb * 0.5

    return Math.max(6, baseHours + cpuMultiplier + memoryMultiplier)
  }

  /**
   * Generate tags based on image properties
   */
  private generateTags(image: DockerImage): string[] {
    const tags = [image.upload_type]

    const imageName = image.image_name.toLowerCase()
    if (imageName.includes('react')) tags.push('React')
    if (imageName.includes('node')) tags.push('Node.js')
    if (imageName.includes('python')) tags.push('Python')
    if (imageName.includes('docker')) tags.push('Docker')
    if (imageName.includes('api')) tags.push('API')
    if (imageName.includes('ml') || imageName.includes('ai')) tags.push('ML')
    if (imageName.includes('web')) tags.push('Web')
    if (imageName.includes('backend')) tags.push('Backend')
    if (imageName.includes('frontend')) tags.push('Frontend')

    // Add resource-based tags
    if (image.requirements.min_cpu_cores >= 8) tags.push('High-CPU')
    if (image.requirements.min_memory_gb >= 16) tags.push('High-Memory')
    if (image.requirements.min_storage_gb >= 50) tags.push('High-Storage')

    return [...new Set(tags)] // Remove duplicates
  }

  /**
   * Get total number of images in registry
   */
  async getTotalImages(): Promise<number> {
    try {
      return await this.client.getTotalImages()
    } catch (error) {
      console.error('Failed to fetch total images count:', error)
      return 0
    }
  }
}

// Create client instance
const createSuiClient = () => {
  // Use the official Sui testnet RPC endpoint for better reliability
  const rpcUrl = 'https://fullnode.testnet.sui.io:443'
  console.log('🔗 Using Sui RPC URL:', rpcUrl)
  return new SuiClient({ url: rpcUrl })
}

// Default registry adapter instance
export const dockerRegistryAdapter = new DockerRegistryAdapter(createSuiClient())

// Helper function to check if registry is configured
export const isRegistryConfigured = (): boolean => {
  return !!(REGISTRY_ID && REGISTRY_ID !== '0x0000000000000000000000000000000000000000000000000000000000000000')
}