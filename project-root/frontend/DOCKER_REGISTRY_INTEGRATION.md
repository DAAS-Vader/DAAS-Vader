# Docker Registry Integration

This document explains how the TaskSelector component integrates with the Sui Move Docker Registry contract.

## Overview

The TaskSelector component has been updated to fetch tasks from the actual Docker Registry contract deployed on the Sui network, instead of using hardcoded mock data.

## Architecture

```
TaskSelector Component
       ↓
DockerRegistryService
       ↓
Sui Client (RPC)
       ↓
Docker Registry Contract (Move)
```

## Configuration

### Environment Variables

Create a `.env.local` file in the frontend directory with the following variables:

```env
# Sui Network Configuration
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://sui-testnet-rpc.testnet-pride.com

# Docker Registry Contract
NEXT_PUBLIC_DOCKER_REGISTRY_ID=0x... # Replace with actual registry object ID

# Package ID for the DAAS Vader contracts
NEXT_PUBLIC_PACKAGE_ID=0x... # Replace with actual package ID
```

### Contract Deployment

1. Deploy the Docker Registry contract using the Move code in `contracts/sources/docker_registry.move`
2. Note the registry object ID from the deployment
3. Update the `NEXT_PUBLIC_DOCKER_REGISTRY_ID` environment variable

## How It Works

### 1. Data Flow

1. **TaskSelector** calls `dockerRegistryService.getAllImages()`
2. **DockerRegistryService** queries the Sui contract using `SuiClient`
3. Contract returns `DockerImage[]` data
4. Service converts `DockerImage` to `Task` format for UI
5. TaskSelector displays the tasks with filtering and sorting

### 2. Data Transformation

The service converts Move contract data structure to TypeScript:

```typescript
// Move contract structure
DockerImage {
  download_urls: vector<String>,
  primary_url_index: u64,
  image_name: String,
  size: u64,
  timestamp: u64,
  upload_type: String,
  requirements: MinRequirements
}

// TypeScript UI structure
Task {
  id: string,
  name: string,
  description: string,
  walrusBlobUrl: string,
  requiredResources: { cpu, memory, storage },
  reward: number,
  deadline: Date,
  status: string,
  createdBy: string,
  createdAt: Date,
  estimatedDuration: number,
  tags: string[]
}
```

### 3. Fallback Behavior

- If the registry is not configured (missing `DOCKER_REGISTRY_ID`), the system uses fallback mock data
- If the registry is empty, it also falls back to mock data
- If there's an error connecting to the registry, it gracefully falls back to mock data

## Contract Functions Used

The integration uses these contract functions:

1. `get_all_images(registry: &DockerRegistry): vector<DockerImage>`
   - Fetches all available Docker images from the registry
   - Used to populate the task list

2. `get_total_images(registry: &DockerRegistry): u64`
   - Gets the total count of images (for stats)

## Features

### Task Generation
- Converts Docker images to deployable tasks
- Generates appropriate tags based on image names and properties
- Estimates task duration based on resource requirements
- Calculates rewards from max_price_per_hour

### Smart Filtering
- Resource-based filtering (CPU, Memory, Storage)
- Reward-based filtering
- Duration-based filtering
- Tag-based search and filtering

### Real-time Updates
- Tasks are loaded on component mount
- Can be extended to include real-time updates via subscriptions

## Development

### Testing Without Contract

For development without a deployed contract:
1. Leave `NEXT_PUBLIC_DOCKER_REGISTRY_ID` unset or set to placeholder
2. The system will automatically use fallback mock data
3. All UI functionality works normally

### Adding New Contract Functions

To add new contract functions:
1. Add the function to `DockerRegistryService`
2. Update the TypeScript interfaces if needed
3. Add appropriate error handling
4. Update the TaskSelector component to use the new data

## Error Handling

The integration includes comprehensive error handling:
- Network connectivity issues
- Invalid contract addresses
- Contract function call failures
- Data parsing errors

All errors are logged to console and the system gracefully falls back to mock data.

## Future Enhancements

1. **Real-time Updates**: Subscribe to contract events for live task updates
2. **User-specific Tasks**: Filter tasks based on connected wallet
3. **Task Status Updates**: Track task completion status on-chain
4. **Bidding System**: Allow providers to bid on tasks
5. **Reputation System**: Integration with provider reputation scores

## Troubleshooting

### Common Issues

1. **"Failed to load tasks from registry"**
   - Check if `NEXT_PUBLIC_DOCKER_REGISTRY_ID` is set correctly
   - Verify the registry object exists on the network
   - Check network connectivity

2. **"Using fallback data due to registry error"**
   - Normal behavior when registry is not configured
   - Check browser console for specific error messages

3. **Empty task list**
   - The registry might be empty (no images uploaded yet)
   - System will show "No tasks match your search criteria"

### Debug Logs

Enable debug logging by checking the browser console. The service logs:
- Registry configuration status
- Network requests and responses
- Data transformation steps
- Error messages with details