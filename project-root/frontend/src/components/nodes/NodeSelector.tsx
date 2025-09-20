"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  MapPin,
  Cpu,
  HardDrive,
  Zap,
  DollarSign,
  Star,
  Clock,
  Filter,
  Globe,
  Check,
  Loader2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkerNode, NodeFilter } from '@/types'
import { nodeRegistryService } from '@/services/nodeRegistry'
import { NodeMetadata, NODE_STATUS } from '@/contracts/types'

interface NodeSelectorProps {
  onSelect: (nodes: WorkerNode[]) => void
  selectedNodes?: WorkerNode[]
  maxNodes?: number
}

const NodeSelector: React.FC<NodeSelectorProps> = ({
  onSelect,
  selectedNodes = [],
  maxNodes = 3
}) => {
  const [filters, setFilters] = useState<NodeFilter>({
    regions: [],
    minCPU: 0,
    maxLatency: 1000,
    maxPrice: 10,
    minReputation: 0
  })

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(selectedNodes.map(n => n.id))
  )
  const [availableNodes, setAvailableNodes] = useState<WorkerNode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 컨트랙트에서 노드 데이터 로드
  useEffect(() => {
    const loadNodes = async () => {
      try {
        setIsLoading(true)
        const nodeMetadataList = await nodeRegistryService.getAllNodes()

        // NodeMetadata를 WorkerNode 형식으로 변환
        const workerNodes: WorkerNode[] = nodeMetadataList
          .filter(node => node.status === NODE_STATUS.ACTIVE)
          .map(convertNodeMetadataToWorkerNode)

        setAvailableNodes(workerNodes)
      } catch (error) {
        console.error('노드 정보 로드 실패:', error)
        setAvailableNodes([])
      } finally {
        setIsLoading(false)
      }
    }

    loadNodes()
  }, [])

  // NodeMetadata를 WorkerNode로 변환하는 함수
  const convertNodeMetadataToWorkerNode = (metadata: NodeMetadata): WorkerNode => {
    const regionMap: Record<string, { region: string, country: string, city: string, lat: number, lng: number }> = {
      'Asia-Seoul': { region: 'asia-pacific', country: 'South Korea', city: 'Seoul', lat: 37.5665, lng: 126.9780 },
      'Asia-Tokyo': { region: 'asia-pacific', country: 'Japan', city: 'Tokyo', lat: 35.6762, lng: 139.6503 },
      'Asia-Singapore': { region: 'asia-pacific', country: 'Singapore', city: 'Singapore', lat: 1.3521, lng: 103.8198 },
      'US-East': { region: 'north-america', country: 'United States', city: 'New York', lat: 40.7128, lng: -74.0060 },
      'US-West': { region: 'north-america', country: 'United States', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      'Europe-London': { region: 'europe', country: 'United Kingdom', city: 'London', lat: 51.5074, lng: -0.1278 },
      'Europe-Frankfurt': { region: 'europe', country: 'Germany', city: 'Frankfurt', lat: 50.1109, lng: 8.6821 }
    }

    const locationInfo = regionMap[metadata.region] || {
      region: 'asia-pacific',
      country: 'Unknown',
      city: metadata.region,
      lat: 0,
      lng: 0
    }

    return {
      id: metadata.provider_address,
      name: `Node-${metadata.provider_address.slice(-6)}`,
      region: locationInfo.region,
      country: locationInfo.country,
      city: locationInfo.city,
      specs: {
        cpu: metadata.cpu_cores,
        memory: metadata.memory_gb,
        storage: metadata.storage_gb
      },
      performance: {
        uptime: 95 + Math.random() * 5, // 더미 데이터
        avgLatency: Math.floor(Math.random() * 100) + 10, // 더미 데이터
        reputation: 85 + Math.floor(Math.random() * 15) // 더미 데이터
      },
      pricing: {
        cpuPrice: 0.02 + Math.random() * 0.02,
        memoryPrice: 0.01 + Math.random() * 0.01,
        basePrice: 0.03 + Math.random() * 0.05
      },
      status: 'available',
      location: { lat: locationInfo.lat, lng: locationInfo.lng }
    }
  }

  const filteredNodes = useMemo(() => {
    return availableNodes.filter(node => {
      const regionMatch = filters.regions.length === 0 || filters.regions.includes(node.region)
      const cpuMatch = node.specs.cpu >= filters.minCPU
      const latencyMatch = node.performance.avgLatency <= filters.maxLatency
      const hourlyPrice = node.pricing.basePrice + (node.specs.cpu * node.pricing.cpuPrice)
      const priceMatch = hourlyPrice <= filters.maxPrice
      const reputationMatch = node.performance.reputation >= filters.minReputation

      return regionMatch && cpuMatch && latencyMatch && priceMatch && reputationMatch
    })
  }, [availableNodes, filters])

  const handleNodeToggle = (node: WorkerNode) => {
    const newSelected = new Set(selectedNodeIds)

    if (newSelected.has(node.id)) {
      newSelected.delete(node.id)
    } else if (newSelected.size < maxNodes) {
      newSelected.add(node.id)
    }

    setSelectedNodeIds(newSelected)

    const selectedNodesArray = filteredNodes.filter(n => newSelected.has(n.id))
    onSelect(selectedNodesArray)
  }

  const calculateEstimatedCost = (nodes: WorkerNode[]) => {
    return nodes.reduce((total, node) => {
      const hourlyPrice = node.pricing.basePrice + (node.specs.cpu * node.pricing.cpuPrice)
      return total + (hourlyPrice * 24) // daily cost
    }, 0)
  }

  const getRegionColor = (region: string) => {
    switch (region) {
      case 'asia-pacific': return 'bg-blue-500'
      case 'north-america': return 'bg-green-500'
      case 'europe': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100'
      case 'busy': return 'text-yellow-600 bg-yellow-100'
      case 'offline': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">워커노드 선택</h2>
          <p className="text-muted-foreground">
            최대 {maxNodes}개의 노드를 선택하여 배포할 수 있습니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
            size="sm"
          >
            목록
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            onClick={() => setViewMode('map')}
            size="sm"
          >
            지도
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" />
          <span className="font-medium">필터</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">지역</label>
            <div className="space-y-2">
              {['asia-pacific', 'north-america', 'europe'].map(region => (
                <label key={region} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.regions.includes(region)}
                    onChange={(e) => {
                      const newRegions = e.target.checked
                        ? [...filters.regions, region]
                        : filters.regions.filter(r => r !== region)
                      setFilters({ ...filters, regions: newRegions })
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {region === 'asia-pacific' ? '아시아-태평양' :
                     region === 'north-america' ? '북미' : '유럽'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">최소 CPU</label>
            <Input
              type="number"
              value={filters.minCPU}
              onChange={(e) => setFilters({ ...filters, minCPU: Number(e.target.value) })}
              placeholder="0"
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">최대 지연시간 (ms)</label>
            <Input
              type="number"
              value={filters.maxLatency}
              onChange={(e) => setFilters({ ...filters, maxLatency: Number(e.target.value) })}
              placeholder="1000"
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">최대 시간당 비용 (SUI)</label>
            <Input
              type="number"
              step="0.01"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
              placeholder="10"
              min="0"
            />
          </div>
        </div>
      </Card>

      {/* Node List/Map */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'map')}>
        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">사용 가능한 노드를 검색하는 중...</p>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">사용 가능한 노드가 없습니다</h3>
              <p className="text-muted-foreground">
                현재 설정된 필터 조건에 맞는 노드가 없습니다.<br />
                필터를 조정하거나 잠시 후 다시 시도해주세요.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredNodes.map(node => {
                const isSelected = selectedNodeIds.has(node.id)
                const hourlyPrice = node.pricing.basePrice + (node.specs.cpu * node.pricing.cpuPrice)

                return (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-primary bg-primary/5'
                          : 'hover:shadow-md'
                      } ${
                        node.status !== 'available' ? 'opacity-60' : ''
                      }`}
                      onClick={() => node.status === 'available' && handleNodeToggle(node)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getRegionColor(node.region)}`} />
                          <h3 className="font-semibold">{node.name}</h3>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <Badge className={getStatusColor(node.status)}>
                          {node.status === 'available' ? '사용가능' :
                           node.status === 'busy' ? '사용중' : '오프라인'}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{node.city}, {node.country}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            <span>{node.specs.cpu} CPU</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            <span>{node.specs.memory} GB</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{node.performance.avgLatency}ms</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            <span>{node.performance.reputation}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>가동률</span>
                          <span>{node.performance.uptime}%</span>
                        </div>
                        <Progress value={node.performance.uptime} className="h-1" />

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">시간당 비용</span>
                          <span className="font-semibold text-primary">
                            {hourlyPrice.toFixed(3)} SUI
                          </span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="map">
          <Card className="p-8">
            <div className="text-center space-y-4">
              <Globe className="w-16 h-16 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-semibold">지도 뷰</h3>
              <p className="text-muted-foreground">
                지도 기반 노드 선택 기능은 곧 제공될 예정입니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mx-auto mb-2" />
                  <span className="text-sm">아시아-태평양 ({availableNodes.filter(n => n.region === 'asia-pacific').length})</span>
                </div>
                <div className="text-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2" />
                  <span className="text-sm">북미 ({availableNodes.filter(n => n.region === 'north-america').length})</span>
                </div>
                <div className="text-center">
                  <div className="w-4 h-4 bg-purple-500 rounded-full mx-auto mb-2" />
                  <span className="text-sm">유럽 ({availableNodes.filter(n => n.region === 'europe').length})</span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Nodes Summary */}
      {selectedNodeIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">선택된 노드 ({selectedNodeIds.size}/{maxNodes})</h3>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="font-semibold text-primary">
                  예상 일일 비용: {calculateEstimatedCost(
                    filteredNodes.filter(n => selectedNodeIds.has(n.id))
                  ).toFixed(3)} SUI
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredNodes
                .filter(n => selectedNodeIds.has(n.id))
                .map(node => (
                  <div key={node.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <div className={`w-2 h-2 rounded-full ${getRegionColor(node.region)}`} />
                    <span className="text-sm font-medium">{node.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {node.performance.avgLatency}ms
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default NodeSelector