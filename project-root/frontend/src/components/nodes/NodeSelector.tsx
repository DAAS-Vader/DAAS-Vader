"use client"

import React, { useState, useMemo } from 'react'
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
  Check
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkerNode, NodeFilter } from '@/types'

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

  // Mock 데이터 (실제로는 API에서 가져올 예정)
  const mockNodes: WorkerNode[] = [
    {
      id: 'seoul-01',
      name: 'Seoul-01',
      region: 'asia-pacific',
      country: 'South Korea',
      city: 'Seoul',
      specs: { cpu: 4, memory: 8, storage: 100 },
      performance: { uptime: 99.8, avgLatency: 12, reputation: 95 },
      pricing: { cpuPrice: 0.025, memoryPrice: 0.01, basePrice: 0.05 },
      status: 'available',
      location: { lat: 37.5665, lng: 126.9780 }
    },
    {
      id: 'tokyo-05',
      name: 'Tokyo-05',
      region: 'asia-pacific',
      country: 'Japan',
      city: 'Tokyo',
      specs: { cpu: 8, memory: 16, storage: 200 },
      performance: { uptime: 99.9, avgLatency: 28, reputation: 98 },
      pricing: { cpuPrice: 0.03, memoryPrice: 0.015, basePrice: 0.08 },
      status: 'available',
      location: { lat: 35.6762, lng: 139.6503 }
    },
    {
      id: 'nyc-12',
      name: 'NYC-12',
      region: 'north-america',
      country: 'United States',
      city: 'New York',
      specs: { cpu: 2, memory: 4, storage: 50 },
      performance: { uptime: 98.5, avgLatency: 145, reputation: 88 },
      pricing: { cpuPrice: 0.02, memoryPrice: 0.008, basePrice: 0.04 },
      status: 'available',
      location: { lat: 40.7128, lng: -74.0060 }
    },
    {
      id: 'london-08',
      name: 'London-08',
      region: 'europe',
      country: 'United Kingdom',
      city: 'London',
      specs: { cpu: 6, memory: 12, storage: 150 },
      performance: { uptime: 99.5, avgLatency: 89, reputation: 92 },
      pricing: { cpuPrice: 0.028, memoryPrice: 0.012, basePrice: 0.06 },
      status: 'busy',
      location: { lat: 51.5074, lng: -0.1278 }
    },
    {
      id: 'singapore-03',
      name: 'Singapore-03',
      region: 'asia-pacific',
      country: 'Singapore',
      city: 'Singapore',
      specs: { cpu: 12, memory: 24, storage: 300 },
      performance: { uptime: 99.7, avgLatency: 35, reputation: 96 },
      pricing: { cpuPrice: 0.035, memoryPrice: 0.018, basePrice: 0.1 },
      status: 'available',
      location: { lat: 1.3521, lng: 103.8198 }
    }
  ]

  const filteredNodes = useMemo(() => {
    return mockNodes.filter(node => {
      const regionMatch = filters.regions.length === 0 || filters.regions.includes(node.region)
      const cpuMatch = node.specs.cpu >= filters.minCPU
      const latencyMatch = node.performance.avgLatency <= filters.maxLatency
      const hourlyPrice = node.pricing.basePrice + (node.specs.cpu * node.pricing.cpuPrice)
      const priceMatch = hourlyPrice <= filters.maxPrice
      const reputationMatch = node.performance.reputation >= filters.minReputation

      return regionMatch && cpuMatch && latencyMatch && priceMatch && reputationMatch
    })
  }, [mockNodes, filters])

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
                  <span className="text-sm">아시아-태평양 ({mockNodes.filter(n => n.region === 'asia-pacific').length})</span>
                </div>
                <div className="text-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2" />
                  <span className="text-sm">북미 ({mockNodes.filter(n => n.region === 'north-america').length})</span>
                </div>
                <div className="text-center">
                  <div className="w-4 h-4 bg-purple-500 rounded-full mx-auto mb-2" />
                  <span className="text-sm">유럽 ({mockNodes.filter(n => n.region === 'europe').length})</span>
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