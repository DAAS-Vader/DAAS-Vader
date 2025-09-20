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
      title: 'Service User',
      subtitle: 'Deploy code and use services',
      description: 'Upload your projects and deploy them on a distributed network to receive safe and efficient services.',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Code Upload & Deploy',
        'Real-time Monitoring',
        'Global CDN',
        'Auto Scaling'
      ],
      benefits: [
        { icon: Cloud, text: '99.9% Uptime Guarantee' },
        { icon: Shield, text: 'Blockchain Security' },
        { icon: Zap, text: 'Fast Deploy (< 30s)' },
        { icon: Globe, text: 'Global Node Network' }
      ]
    },
    {
      id: 'provider',
      title: 'Node Provider',
      subtitle: 'Provide computing resources and earn revenue',
      description: 'Provide your spare computing resources to the network to generate continuous revenue and contribute to the decentralized ecosystem.',
      icon: Server,
      color: 'from-green-500 to-emerald-500',
      features: [
        'Resource Sales & Monetization',
        'Automatic Job Assignment',
        'Revenue Dashboard',
        'Reputation System'
      ],
      benefits: [
        { icon: Coins, text: '24/7 Passive Income' },
        { icon: Zap, text: 'Auto Optimization' },
        { icon: Shield, text: 'Smart Contract Guarantee' },
        { icon: Globe, text: 'Global Demand Matching' }
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
            How would you like to participate?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose your desired role on the decentralized serverless platform
            and start a new Web3 experience
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
                    <h4 className="font-semibold mb-3">Key Features</h4>
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
                    <h4 className="font-semibold mb-3">Core Benefits</h4>
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
                    Start as {role.title}
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
            You can switch roles at any time. Please select your preferred role first.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default RoleSelector