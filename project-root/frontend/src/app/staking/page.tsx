'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StakingPoolStats from '@/components/StakingPoolStats'
import Link from 'next/link'

export default function StakingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Server className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold">스테이킹 풀 현황</h1>
              </div>
              <Badge variant="outline">Worker Registry</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">워커 노드 스테이킹 현황</h2>
            <p className="text-muted-foreground">
              실시간 온체인 데이터를 기반으로 한 워커 노드 풀 통계입니다.
            </p>
          </div>

          {/* Staking Pool Stats Component */}
          <StakingPoolStats />

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-6 bg-muted/50 rounded-lg"
          >
            <h3 className="text-lg font-semibold mb-3">Contract Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package ID:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">
                  0x664356de3f1ce1df7d8039fb7f244dba3baec08025d791d15245876c76253bfc
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker Registry:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">
                  0xca7ddf00a634c97b126aac539f0d5e8b8df20ad4e88b5f7b5f18291fbe6f0981
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span className="font-medium">Sui Testnet</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}