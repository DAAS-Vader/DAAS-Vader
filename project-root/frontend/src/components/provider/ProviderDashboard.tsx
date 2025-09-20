'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import NodeSetup from './NodeSetup'
import NodeOperationDashboard from './NodeOperationDashboard'

interface ResourceConfig {
  cpu: number
  memory: number
  storage: number
  bandwidth: number
  pricePerHour: number
}

type ViewState = 'wallet' | 'dashboard' | 'node-setup'

interface ProviderDashboardProps {
  onRoleChange?: () => void
}

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ onRoleChange }) => {
  const [currentView, setCurrentView] = useState<ViewState>('wallet')
  const currentAccount = useCurrentAccount()

  // Auto-advance when wallet is connected
  useEffect(() => {
    if (currentAccount && currentView === 'wallet') {
      setCurrentView('dashboard')
    } else if (!currentAccount && currentView !== 'wallet') {
      setCurrentView('wallet')
    }
  }, [currentAccount, currentView])

  const handleNodeCreate = () => {
    setCurrentView('node-setup')
  }

  const handleNodeSetupComplete = () => {
    setCurrentView('dashboard')
  }

  const handleNodeSetupCancel = () => {
    setCurrentView('dashboard')
  }

  // 지갑 연결 화면
  if (currentView === 'wallet') {
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
                <Badge variant="outline" className="ml-2">
                  노드 제공자
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {onRoleChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRoleChange}
                  >
                    역할 변경
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Wallet Connection */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-2">노드 제공자 시작하기</h1>
            <p className="text-muted-foreground text-lg">
              먼저 지갑을 연결하여 노드 제공자로 참여하세요
            </p>
          </motion.div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">지갑 연결</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Sui 네트워크에 연결하여 노드 제공자로 참여하세요.
            </p>
            <div className="flex justify-center">
              <ConnectButton className="w-full max-w-sm" />
            </div>
            {currentAccount && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">연결된 주소:</p>
                <p className="text-xs font-mono mt-1">{currentAccount.address}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    )
  }

  // 노드 생성 화면
  if (currentView === 'node-setup') {
    return (
      <NodeSetup
        onNodeCreate={handleNodeSetupComplete}
        onCancel={handleNodeSetupCancel}
        walletInfo={walletInfo}
        onRoleChange={onRoleChange}
      />
    )
  }

  // 운영 대시보드 (기본 화면)
  return (
    <NodeOperationDashboard
      onNodeCreate={handleNodeCreate}
      walletInfo={walletInfo}
      onWalletDisconnect={handleWalletDisconnect}
      onRoleChange={onRoleChange}
    />
  )
}

export default ProviderDashboard