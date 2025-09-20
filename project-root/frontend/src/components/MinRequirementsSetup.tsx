'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Cpu, HardDrive, MemoryStick, DollarSign } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface MinRequirements {
  min_cpu_cores: number
  min_memory_gb: number
  min_storage_gb: number
  max_price_per_hour: number
}

interface MinRequirementsSetupProps {
  onComplete: (requirements: MinRequirements) => void
  onCancel?: () => void
}

const MinRequirementsSetup: React.FC<MinRequirementsSetupProps> = ({
  onComplete,
  onCancel
}) => {
  const [requirements, setRequirements] = useState<MinRequirements>({
    min_cpu_cores: 1,
    min_memory_gb: 1,
    min_storage_gb: 10,
    max_price_per_hour: 100 // default value: 100 SUI/hour
  })

  const [errors, setErrors] = useState<Partial<MinRequirements>>({})

  const validateRequirements = (): boolean => {
    const newErrors: Partial<MinRequirements> = {}

    if (requirements.min_cpu_cores < 1) {
      newErrors.min_cpu_cores = 1
    }

    if (requirements.min_memory_gb < 1) {
      newErrors.min_memory_gb = 1
    }

    if (requirements.min_storage_gb < 1) {
      newErrors.min_storage_gb = 1
    }

    if (requirements.max_price_per_hour <= 0) {
      newErrors.max_price_per_hour = 1
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateRequirements()) {
      onComplete(requirements)
    }
  }

  const updateRequirement = (field: keyof MinRequirements, value: number) => {
    setRequirements(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">D</span>
              </div>
              <h1 className="text-xl font-bold">DaaS Platform</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Set Minimum Requirements</h1>
          <p className="text-muted-foreground text-lg">
            Set the minimum hardware specs and maximum hourly price for your project.
          </p>
        </motion.div>

        <Card className="p-8">
          <div className="space-y-8">
            {/* CPU Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-blue-600" />
                <Label htmlFor="cpu" className="text-lg font-semibold">
                  Minimum CPU cores
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    id="cpu"
                    type="number"
                    min="1"
                    max="32"
                    value={requirements.min_cpu_cores}
                    onChange={(e) => updateRequirement('min_cpu_cores', parseInt(e.target.value) || 1)}
                    className={errors.min_cpu_cores ? 'border-red-500' : ''}
                  />
                  {errors.min_cpu_cores && (
                    <p className="text-red-500 text-sm mt-1">Must be at least 1 core</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center">
                  Recommended: 1-2 cores for web apps, 4-8 cores for data processing
                </div>
              </div>
            </div>

            {/* Memory Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <MemoryStick className="w-5 h-5 text-green-600" />
                <Label htmlFor="memory" className="text-lg font-semibold">
                  Minimum memory (GB)
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    id="memory"
                    type="number"
                    min="1"
                    max="128"
                    value={requirements.min_memory_gb}
                    onChange={(e) => updateRequirement('min_memory_gb', parseInt(e.target.value) || 1)}
                    className={errors.min_memory_gb ? 'border-red-500' : ''}
                  />
                  {errors.min_memory_gb && (
                    <p className="text-red-500 text-sm mt-1">Must be at least 1 GB</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center">
                  Recommended: 1-4 GB for web apps, 8-16 GB for databases
                </div>
              </div>
            </div>

            {/* Storage Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-purple-600" />
                <Label htmlFor="storage" className="text-lg font-semibold">
                  Minimum storage (GB)
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    id="storage"
                    type="number"
                    min="1"
                    max="1000"
                    value={requirements.min_storage_gb}
                    onChange={(e) => updateRequirement('min_storage_gb', parseInt(e.target.value) || 1)}
                    className={errors.min_storage_gb ? 'border-red-500' : ''}
                  />
                  {errors.min_storage_gb && (
                    <p className="text-red-500 text-sm mt-1">Must be at least 1 GB</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center">
                  Recommended: 10-50 GB for basic apps, 100+ GB for data-heavy workloads
                </div>
              </div>
            </div>

            {/* Pricing Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-yellow-600" />
                <Label htmlFor="price" className="text-lg font-semibold">
                  Maximum price (SUI/hour)
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    id="price"
                    type="number"
                    min="1"
                    step="0.01"
                    value={requirements.max_price_per_hour}
                    onChange={(e) => updateRequirement('max_price_per_hour', parseFloat(e.target.value) || 0)}
                    className={errors.max_price_per_hour ? 'border-red-500' : ''}
                  />
                  {errors.max_price_per_hour && (
                    <p className="text-red-500 text-sm mt-1">Must be greater than 0</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center">
                  Upper limit for the hourly rate providers can request
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/30 p-6 rounded-lg">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">CPU</div>
                  <div className="font-semibold">{requirements.min_cpu_cores} cores minimum</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Memory</div>
                  <div className="font-semibold">{requirements.min_memory_gb}GB minimum</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Storage</div>
                  <div className="font-semibold">{requirements.min_storage_gb}GB minimum</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Maximum Price</div>
                  <div className="font-semibold">{requirements.max_price_per_hour} SUI/hour</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Back
                </Button>
              )}
              <Button onClick={handleSubmit} className="ml-auto">
                Next step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default MinRequirementsSetup