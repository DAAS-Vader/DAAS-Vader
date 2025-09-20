'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Server,
  ArrowRight,
  Cloud,
  Coins,
  Shield,
  Zap,
  Globe
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface RoleSelectorProps {
  onRoleSelect: (role: 'user' | 'provider') => void
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onRoleSelect }) => {
  const roles = [
    {
      id: 'user',
      title: '서비스 사용자',
      subtitle: '코드를 배포하고 서비스를 이용하세요',
      description: '프로젝트를 업로드하고 분산 네트워크에 배포하여 안전하고 효율적인 서비스를 제공받으세요.',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      features: [
        '코드 업로드 & 배포',
        '실시간 모니터링',
        '글로벌 CDN',
        '자동 스케일링'
      ],
      benefits: [
        { icon: Cloud, text: '99.9% 가동률 보장' },
        { icon: Shield, text: '블록체인 보안' },
        { icon: Zap, text: '빠른 배포 (< 30초)' },
        { icon: Globe, text: '전세계 노드 네트워크' }
      ]
    },
    {
      id: 'provider',
      title: '노드 제공자',
      subtitle: '컴퓨팅 자원을 제공하고 수익을 얻으세요',
      description: '여유 컴퓨팅 자원을 네트워크에 제공하여 지속적인 수익을 창출하고 탈중앙화 생태계에 기여하세요.',
      icon: Server,
      color: 'from-green-500 to-emerald-500',
      features: [
        '자원 판매 & 수익화',
        '자동 작업 배정',
        '수익 대시보드',
        '평판 시스템'
      ],
      benefits: [
        { icon: Coins, text: '24/7 패시브 인컴' },
        { icon: Zap, text: '자동 최적화' },
        { icon: Shield, text: '스마트 컨트랙트 보장' },
        { icon: Globe, text: '글로벌 수요 매칭' }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src="/DAAS-VADER.svg"
              alt="DaaS Platform Logo"
              className="w-16 h-16"
            />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              DaaS Platform
            </h1>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            어떤 역할로 참여하시겠습니까?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            탈중앙화 서버리스 플랫폼에서 원하는 역할을 선택하여
            Web3의 새로운 경험을 시작하세요
          </p>
        </motion.div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {roles.map((role, index) => {
            const Icon = role.icon

            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="group"
              >
                <Card className="p-8 h-full border-2 hover:border-primary/50 transition-all duration-300 overflow-hidden relative">
                  {/* Background Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Title & Subtitle */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2">{role.title}</h3>
                    <p className="text-muted-foreground text-lg">{role.subtitle}</p>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {role.description}
                  </p>

                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="font-semibold mb-3">주요 기능</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {role.features.map((feature) => (
                        <Badge key={feature} variant="secondary" className="justify-start">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="mb-8">
                    <h4 className="font-semibold mb-3">핵심 장점</h4>
                    <div className="space-y-3">
                      {role.benefits.map((benefit) => {
                        const BenefitIcon = benefit.icon
                        return (
                          <div key={benefit.text} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center`}>
                              <BenefitIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm">{benefit.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => onRoleSelect(role.id as 'user' | 'provider')}
                    className={`w-full bg-gradient-to-r ${role.color} hover:opacity-90 text-white border-0 group-hover:scale-105 transition-transform duration-300`}
                    size="lg"
                  >
                    {role.title}로 시작하기
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-muted-foreground">
            언제든지 역할을 전환할 수 있습니다. 먼저 원하는 역할을 선택해주세요.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default RoleSelector