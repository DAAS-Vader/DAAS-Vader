import dotenv from 'dotenv';
import { Config } from '../types/index.js';

dotenv.config();

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Authentication
  auth: {
    devAdminToken: process.env.DEV_ADMIN_TOKEN || 'dev-allow',
    sessionSecret: process.env.SESSION_SECRET || 'change-me-32bytes'
  },
  
  // External Services
  seal: {
    url: process.env.SEAL_URL || 'https://seal.example.com',
    serviceToken: process.env.SEAL_SERVICE_TOKEN || 'server-token',
    ticketSecret: process.env.SEAL_TICKET_SECRET || 'shared-hs256-secret'
  },

  // Seal v2 (Move Contracts)
  sealV2: {
    packageId: process.env.SEAL_PACKAGE_ID,
    sealRegistryId: process.env.SEAL_REGISTRY_ID,
    enclaveRegistryId: process.env.ENCLAVE_REGISTRY_ID,
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY,
    defaultIdentity: process.env.DEFAULT_IDENTITY
  },

  // Sui Configuration
  sui: {
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    networkType: process.env.SUI_NETWORK || 'testnet'
  },
  
  walrus: {
    // SDK configuration
    useSDK: process.env.USE_WALRUS_SDK === 'true',
    network: process.env.WALRUS_NETWORK || 'testnet',
    keypairSeed: process.env.WALRUS_KEYPAIR_SEED,
    walCoinType: process.env.WALRUS_WAL_COIN_TYPE
  },
  
  // GitHub App
  github: {
    appId: process.env.GITHUB_APP_ID,
    privateKeyPem: process.env.GITHUB_APP_PRIVATE_KEY_PEM,
    webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET || 'change-me',
    appSlug: process.env.GITHUB_APP_SLUG || 'my-daas-app'
  },
  
  // File processing limits
  limits: {
    secretFileSize: 10 * 1024 * 1024, // 10MB per secret file
    secretBundleSize: 20 * 1024 * 1024, // 20MB total secrets
    codeBundleSize: 200 * 1024 * 1024, // 200MB code bundle
    requestTimeout: 180 * 1000 // 180 seconds
  },
  
  // Default ignore patterns
  defaultIgnorePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    '.next/**',
    'build/**',
    '.cache/**',
    'coverage/**',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
    '.env*',
    '!.env.example',
    '!.env.sample',
    '!.env.template'
  ]
};

export default config;