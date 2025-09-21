import { SuiClient } from '@mysten/sui/client'
import { Task } from '@/types'
import { PACKAGE_ID, REGISTRY_ID } from '@/lib/docker-registry'

export class DockerRegistryService {
  private client: SuiClient
  private registryObjectId: string

  constructor(client: SuiClient, registryObjectId: string) {
    this.client = client
    this.registryObjectId = registryObjectId
  }

  /**
   * Get all Docker images from the registry
   */
  async getAllImages(): Promise<DockerImage[]> {
    try {
      const result = await this.client.getObject({
        id: this.registryObjectId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (result.data?.content && 'fields' in result.data.content) {
        const fields = result.data.content.fields as any
        return fields.all_images || []
      }

      return []
    } catch (error) {
      console.error('Failed to fetch images from registry:', error)
      return []
    }
  }

  /**
   * Get user-specific images from the registry
   */
  async getUserImages(userAddress: string): Promise<DockerImage[]> {
    try {
      const result = await this.client.getObject({
        id: this.registryObjectId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (result.data?.content && 'fields' in result.data.content) {
        const fields = result.data.content.fields as any
        const imagesTable = fields.images

        // In a real implementation, you would need to query the table
        // This is a simplified version
        return []
      }

      return []
    } catch (error) {
      console.error('Failed to fetch user images:', error)
      return []
    }
  }

  /**
   * Convert DockerImage to Task format for the UI
   */
  convertToTasks(images: DockerImage[]): Task[] {
    return images.map((image, index) => ({
      id: `task-${index}`,
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

    if (image.image_name.toLowerCase().includes('react')) tags.push('React')
    if (image.image_name.toLowerCase().includes('node')) tags.push('Node.js')
    if (image.image_name.toLowerCase().includes('python')) tags.push('Python')
    if (image.image_name.toLowerCase().includes('docker')) tags.push('Docker')
    if (image.image_name.toLowerCase().includes('api')) tags.push('API')
    if (image.image_name.toLowerCase().includes('ml') || image.image_name.toLowerCase().includes('ai')) tags.push('ML')

    // Add resource-based tags
    if (image.requirements.min_cpu_cores >= 8) tags.push('High-CPU')
    if (image.requirements.min_memory_gb >= 16) tags.push('High-Memory')
    if (image.requirements.min_storage_gb >= 50) tags.push('High-Storage')

    return tags
  }

  /**
   * Get total number of images in registry
   */
  async getTotalImages(): Promise<number> {
    try {
      const result = await this.client.getObject({
        id: this.registryObjectId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (result.data?.content && 'fields' in result.data.content) {
        const fields = result.data.content.fields as any
        return fields.total_images || 0
      }

      return 0
    } catch (error) {
      console.error('Failed to fetch total images count:', error)
      return 0
    }
  }
}

// Types matching the Move contract
export interface DockerImage {
  download_urls: string[]
  primary_url_index: number
  image_name: string
  size: number
  timestamp: number
  upload_type: string
  requirements: MinRequirements
}

export interface MinRequirements {
  min_cpu_cores: number
  min_memory_gb: number
  min_storage_gb: number
  max_price_per_hour: number
}

// Create client instance
const createSuiClient = () => {
  const rpcUrl = process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://sui-testnet-rpc.testnet-pride.com'
  return new SuiClient({ url: rpcUrl })
}

// Default registry service instance
export const dockerRegistryService = new DockerRegistryService(
  createSuiClient(),
  REGISTRY_ID
)

// Helper function to check if registry is configured
export const isRegistryConfigured = (): boolean => {
  return !!(REGISTRY_ID && REGISTRY_ID !== '0x0000000000000000000000000000000000000000000000000000000000000000')
}
