import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Task } from '@/types'
import { PACKAGE_ID, REGISTRY_ID } from '@/lib/docker-registry'

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

export class MoveRegistryAdapter {
  private suiClient: SuiClient

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient
  }

  /**
   * Check registry status and basic info
   */
  async checkRegistryStatus(): Promise<any> {
    try {
      console.log('🔍 Checking registry status...')
      console.log('📋 Registry ID:', REGISTRY_ID)

      const registryObject = await this.suiClient.getObject({
        id: REGISTRY_ID,
        options: {
          showContent: true,
          showType: true,
        },
      })

      console.log('📋 Registry object:', JSON.stringify(registryObject, null, 2))
      return registryObject
    } catch (error) {
      console.error('❌ Failed to check registry status:', error)
      return null
    }
  }

  /**
   * Get all Docker images using Move contract function get_all_images
   */
  async getAllImages(): Promise<DockerImage[]> {
    try {
      console.log('🚀 Getting all images from registry...')
      console.log('📋 Registry ID:', REGISTRY_ID)

      // 레지스트리 객체에서 직접 all_images 필드 읽기
      const registryObject = await this.suiClient.getObject({
        id: REGISTRY_ID,
        options: {
          showContent: true,
          showType: true,
        },
      })

      console.log('📋 Registry object for images:', JSON.stringify(registryObject, null, 2))

      if (registryObject.data?.content?.dataType === 'moveObject') {
        const fields = (registryObject.data.content as { fields: Record<string, unknown> }).fields
        const allImages = fields.all_images as any[]

        if (allImages && Array.isArray(allImages)) {
          console.log(`📦 Found ${allImages.length} images in all_images field`)
          const images = this.parseDirectImageArray(allImages)
          console.log('✅ Successfully parsed', images.length, 'images from registry object')
          return images
        } else {
          console.log('⚠️ No all_images field or not an array')
        }
      }

      console.log('⚠️ Registry object structure not as expected')
      return []
    } catch (error) {
      console.error('❌ Failed to get all images from registry:', error)
      return []
    }
  }

  private parseDirectImageArray(images: any[]): DockerImage[] {
    console.log('🔍 === PARSING DIRECT IMAGE ARRAY ===')

    return images.map((item: any, index: number) => {
      console.log(`📋 === Processing image ${index} ===`)
      console.log(`📋 Raw item:`, JSON.stringify(item, null, 2))

      // 레지스트리 객체에서 온 이미지 구조 처리
      const fields = item.fields || item

      const imageName = fields.image_name
      const uploadType = fields.upload_type
      const downloadUrls = fields.download_urls || []
      const primaryUrlIndex = parseInt(fields.primary_url_index || '0')
      const size = parseInt(fields.size || '0')
      const timestamp = parseInt(fields.timestamp || '0')

      // requirements 필드 처리
      const reqFields = fields.requirements?.fields || {}
      const requirements = {
        min_cpu_cores: reqFields.min_cpu_cores || 1,
        min_memory_gb: reqFields.min_memory_gb || 1,
        min_storage_gb: reqFields.min_storage_gb || 1,
        max_price_per_hour: parseInt(reqFields.max_price_per_hour || '1000000')
      }

      console.log(`📋 Extracted name: "${imageName}"`)
      console.log(`📋 Extracted type: "${uploadType}"`)
      console.log(`📋 Extracted URLs:`, downloadUrls)
      console.log(`📋 Extracted requirements:`, requirements)

      return {
        download_urls: downloadUrls,
        primary_url_index: primaryUrlIndex,
        image_name: imageName,
        size: size,
        timestamp: timestamp,
        upload_type: uploadType,
        requirements: requirements
      }
    }).filter(item => item.image_name && item.download_urls.length > 0) as DockerImage[]
  }

  private parseAllImages(data: unknown): DockerImage[] {
    try {
      console.log('🔍 === PARSING START ===')
      console.log('🔍 Raw data:', JSON.stringify(data, null, 2))
      console.log('🔍 Data type:', typeof data)

      // Sui Move vector<DockerImage> 파싱
      // devInspectTransactionBlock에서 반환되는 BCS 데이터 처리

      // 직접 배열인 경우
      if (Array.isArray(data)) {
        console.log('📦 Direct array with', data.length, 'items')
        return this.processImageArray(data)
      }

      // BCS 인코딩된 데이터 구조 처리
      if (typeof data === 'object' && data !== null) {
        const dataObj = data as any
        console.log('📦 Object keys:', Object.keys(dataObj))

        // Sui BCS vector 구조: [0] = 벡터 길이, [1] = 첫 번째 요소, [2] = 두 번째 요소, ...
        if (Array.isArray(dataObj) && dataObj.length > 0) {
          console.log('📦 BCS vector structure detected')
          // 첫 번째 요소가 길이일 가능성이 높음
          const vectorLength = typeof dataObj[0] === 'number' ? dataObj[0] : dataObj.length
          console.log('📦 Vector length:', vectorLength)

          if (vectorLength > 0 && dataObj.length > 1) {
            // 실제 데이터는 인덱스 1부터 시작
            const imageData = dataObj.slice(1, vectorLength + 1)
            console.log('📦 Image data from BCS vector:', imageData)
            return this.processImageArray(imageData)
          }
        }

        // 표준 중첩 구조
        if (dataObj.value && Array.isArray(dataObj.value)) {
          console.log('📦 Found value array with', dataObj.value.length, 'items')
          return this.processImageArray(dataObj.value)
        }

        // Move object 구조
        if (dataObj.contents && Array.isArray(dataObj.contents)) {
          console.log('📦 Found contents array with', dataObj.contents.length, 'items')
          return this.processImageArray(dataObj.contents)
        }
      }

      console.log('⚠️ No parseable image data found')
      return []
    } catch (error) {
      console.error('❌ Failed to parse all images:', error)
      return []
    }
  }

  private processImageArray(items: any[]): DockerImage[] {
    return items.map((item: any, index: number) => {
      console.log(`📋 === Processing image ${index} ===`)
      console.log(`📋 Raw item:`, JSON.stringify(item, null, 2))

      // Sui Move DockerImage 구조체 처리
      // BCS 인코딩된 구조체는 배열 형태로 올 수 있음: [field1, field2, field3, ...]
      let imageData: any

      if (Array.isArray(item)) {
        // BCS 구조체를 배열로 받는 경우 - Move 구조체의 필드 순서대로
        // DockerImage 필드 순서: download_urls, primary_url_index, image_name, size, timestamp, upload_type, requirements
        console.log(`📋 BCS struct array with ${item.length} fields`)
        imageData = {
          download_urls: item[0],
          primary_url_index: item[1],
          image_name: item[2],
          size: item[3],
          timestamp: item[4],
          upload_type: item[5],
          requirements: item[6]
        }
      } else {
        // 일반적인 객체 구조
        imageData = item.fields || item.value || item
      }

      console.log(`📋 Processed image data:`, JSON.stringify(imageData, null, 2))

      const imageName = this.extractString(imageData.image_name)
      const uploadType = this.extractString(imageData.upload_type)
      const downloadUrls = this.extractStringArray(imageData.download_urls)

      console.log(`📋 Extracted name: "${imageName}"`)
      console.log(`📋 Extracted type: "${uploadType}"`)
      console.log(`📋 Extracted URLs:`, downloadUrls)

      // Skip items where we can't extract essential data
      if (!imageName || !downloadUrls || downloadUrls.length === 0) {
        console.log(`⚠️ Skipping image ${index} - missing essential data`)
        return null
      }

      // requirements 처리 (BCS 구조체 또는 일반 객체)
      let requirements: any = imageData.requirements || {}
      if (Array.isArray(requirements)) {
        // MinRequirements BCS 구조: [min_cpu_cores, min_memory_gb, min_storage_gb, max_price_per_hour]
        requirements = {
          min_cpu_cores: requirements[0],
          min_memory_gb: requirements[1],
          min_storage_gb: requirements[2],
          max_price_per_hour: requirements[3]
        }
      }

      return {
        download_urls: downloadUrls,
        primary_url_index: this.extractNumber(imageData.primary_url_index) || 0,
        image_name: imageName,
        size: this.extractNumber(imageData.size) || 0,
        timestamp: this.extractNumber(imageData.timestamp) || 0,
        upload_type: uploadType || 'unknown',
        requirements: {
          min_cpu_cores: this.extractNumber(requirements.min_cpu_cores) || 1,
          min_memory_gb: this.extractNumber(requirements.min_memory_gb) || 1,
          min_storage_gb: this.extractNumber(requirements.min_storage_gb) || 1,
          max_price_per_hour: this.extractNumber(requirements.max_price_per_hour) || 1000000
        }
      }
    }).filter(Boolean) as DockerImage[]
  }

  private extractString(value: any): string | null {
    console.log(`🔍 extractString input:`, value, `type: ${typeof value}`)

    if (typeof value === 'string') return value

    // Sui Move String 타입 처리 - 일반적으로 BCS 인코딩된 형태
    if (Array.isArray(value)) {
      // BCS 인코딩된 바이트 배열을 문자열로 변환
      try {
        const text = new TextDecoder().decode(new Uint8Array(value))
        console.log(`🔍 Decoded from byte array: "${text}"`)
        return text
      } catch (e) {
        console.log('Failed to decode byte array:', e)
      }
    }

    // 중첩된 구조에서 바이트 배열 찾기
    if (value?.fields?.bytes && Array.isArray(value.fields.bytes)) {
      try {
        const text = new TextDecoder().decode(new Uint8Array(value.fields.bytes))
        console.log(`🔍 Decoded from fields.bytes: "${text}"`)
        return text
      } catch (e) {
        console.log('Failed to decode fields.bytes:', e)
      }
    }

    // value 필드 재귀 검사
    if (value?.value) {
      return this.extractString(value.value)
    }

    console.log(`⚠️ Could not extract string from:`, value)
    return null
  }

  private extractNumber(value: any): number | null {
    console.log(`🔍 extractNumber input:`, value, `type: ${typeof value}`)

    if (typeof value === 'number') return value

    if (typeof value === 'string') {
      const num = parseInt(value)
      return isNaN(num) ? null : num
    }

    // Sui Move u64, u32 등의 숫자 타입 처리
    if (typeof value === 'bigint') {
      return Number(value)
    }

    // BCS 인코딩된 숫자 (보통 문자열로 표현됨)
    if (value?.toString && typeof value.toString === 'function') {
      const str = value.toString()
      const num = parseInt(str)
      if (!isNaN(num)) {
        console.log(`🔍 Extracted number: ${num}`)
        return num
      }
    }

    // 중첩된 value 필드
    if (value?.value !== undefined) {
      return this.extractNumber(value.value)
    }

    console.log(`⚠️ Could not extract number from:`, value)
    return null
  }

  private extractStringArray(value: any): string[] | null {
    console.log(`🔍 extractStringArray input:`, value, `type: ${typeof value}`)

    // 직접 배열인 경우
    if (Array.isArray(value)) {
      const strings = value.map(v => this.extractString(v)).filter(Boolean) as string[]
      console.log(`🔍 Extracted ${strings.length} strings from direct array:`, strings)
      return strings.length > 0 ? strings : null
    }

    // Sui Move vector<String> 타입 처리
    // Move vector는 보통 { contents: [...] } 구조로 나타남
    if (value?.contents && Array.isArray(value.contents)) {
      const strings = value.contents.map((v: any) => this.extractString(v)).filter(Boolean) as string[]
      console.log(`🔍 Extracted ${strings.length} strings from contents:`, strings)
      return strings.length > 0 ? strings : null
    }

    // 중첩된 구조 처리
    if (value?.fields?.contents && Array.isArray(value.fields.contents)) {
      const strings = value.fields.contents.map((v: any) => this.extractString(v)).filter(Boolean) as string[]
      console.log(`🔍 Extracted ${strings.length} strings from fields.contents:`, strings)
      return strings.length > 0 ? strings : null
    }

    // value 필드 재귀 검사
    if (value?.value) {
      return this.extractStringArray(value.value)
    }

    console.log(`⚠️ Could not extract string array from:`, value)
    return null
  }

  /**
   * Convert DockerImage to Task format for the UI
   */
  convertToTasks(images: DockerImage[]): Task[] {
    return images.map((image, index) => ({
      id: `registry-${index}`,
      name: image.image_name,
      description: `Deploy ${image.image_name} (${image.upload_type})`,
      walrusBlobUrl: image.download_urls[image.primary_url_index] || image.download_urls[0] || '',
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

  private estimateTaskDuration(image: DockerImage): number {
    const baseHours = 24
    const cpuMultiplier = image.requirements.min_cpu_cores * 2
    const memoryMultiplier = image.requirements.min_memory_gb * 0.5

    return Math.max(6, baseHours + cpuMultiplier + memoryMultiplier)
  }

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

    // Add resource-based tags
    if (image.requirements.min_cpu_cores >= 8) tags.push('High-CPU')
    if (image.requirements.min_memory_gb >= 16) tags.push('High-Memory')
    if (image.requirements.min_storage_gb >= 50) tags.push('High-Storage')

    return [...new Set(tags)] // Remove duplicates
  }
}

// Create client instance
const createSuiClient = () => {
  const rpcUrl = 'https://fullnode.testnet.sui.io:443'
  console.log('🔗 Using Sui RPC URL:', rpcUrl)

  return new SuiClient({ url: rpcUrl })
}

// Default registry adapter instance
export const moveRegistryAdapter = new MoveRegistryAdapter(createSuiClient())

// Helper function to check if registry is configured
export const isRegistryConfigured = (): boolean => {
  return !!(REGISTRY_ID && REGISTRY_ID !== '0x0000000000000000000000000000000000000000000000000000000000000000')
}