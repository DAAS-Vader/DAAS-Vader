# DAAS-Vader

Decentralized application deployment platform using Sui blockchain and Walrus distributed storage.

## Architecture

### Walrus Storage Layer

- **Blob Storage**: Store files as immutable blob objects in Walrus network
- **Content Addressing**: Assign unique IDs to each blob for permanent reference
- **Gateway Access**: Direct access support through Walrus gateway endpoints

### Sui Smart Contracts

- **Deployment Registry**: Store Docker image metadata and blob IDs on-chain
- **Owner Mapping**: Manage connections between wallet addresses and deployed images

### Deployment Flow

1. **Local Build**: Users build Docker images on their local machine
2. **Export to TAR**: Docker save command creates uploadable archive
3. **Client Upload**: Browser-based upload of tar file to Walrus
4. **Blob Storage**: Walrus stores the Docker image as immutable blob
5. **On-chain Record**: Sui contract stores blob reference and metadata
6. **Access URL**: Gateway endpoint generated for deployment access

## Project Structure

```
project-root/
├── frontend/         # Next.js web application (UI/UX, wallet integration, API communication)
├── docs/            # Project documentation, API specifications, architecture design documents
├── walrus/          # Walrus distributed storage configuration files and data upload scripts
└── seal/            # Seal encryption module for secure data storage
```

## Getting Started

### Requirements

- Node.js 18+
- npm or yarn
- Sui wallet (Suiet or Slush Wallet)
- Testnet SUI tokens

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Access the application at http://localhost:3000

## Usage Guide

### 1. Connect Wallet

Connect your Sui wallet to get started. Make sure you have testnet SUI tokens for gas fees.

### 2. Upload Options

- **Project Folders**: Select and upload entire project directories
- **Docker Images**: Upload .tar files created with `docker save`
- **Individual Files**: Support for single file uploads

### 3. Docker Deployment

```bash
# Build Docker image
docker build -t myapp .

# Save as tar archive
docker save myapp > myapp.tar

# Upload the tar file through the platform
```

### 4. Access Deployed Applications

After upload completion, you'll receive:

- Blob ID for permanent reference
- Direct access URL through Walrus gateways
- On-chain deployment record

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Blockchain**: Sui Network
- **Storage**: Walrus Decentralized Storage
- **Smart Contracts**: Move
