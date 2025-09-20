import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

// Contract addresses from deployment
const PACKAGE_ID = '0x664356de3f1ce1df7d8039fb7f244dba3baec08025d791d15245876c76253bfc';
const WORKER_REGISTRY_ID = '0xca7ddf00a634c97b126aac539f0d5e8b8df20ad4e88b5f7b5f18291fbe6f0981';

export interface PoolStats {
  totalWorkers: number;
  activeWorkers: number;
  totalStake: number;
}

export class WorkerRegistryService {
  private client: SuiClient;

  constructor(rpcUrl: string = process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443') {
    this.client = new SuiClient({ url: rpcUrl });
  }

  /**
   * Get staking pool statistics from the Worker Registry
   * Calls get_pool_stats(registry: &WorkerRegistry): (u64, u64, u64)
   * Returns: (total_workers, active_workers, total_stake)
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      console.log('📊 Fetching pool statistics from Worker Registry...');

      // Create a transaction to call the view function
      const tx = new Transaction();

      // Call the get_pool_stats function
      tx.moveCall({
        target: `${PACKAGE_ID}::worker_registry::get_pool_stats`,
        arguments: [
          tx.object(WORKER_REGISTRY_ID)
        ],
      });

      // Execute the transaction in dev inspect mode (read-only)
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

      console.log('📊 Pool stats result:', result);

      // Parse the return values
      if (result.results && result.results.length > 0) {
        const returnValues = result.results[0].returnValues;
        if (returnValues && returnValues.length >= 3) {
          // The function returns (u64, u64, u64)
          // returnValues are already base64 strings or arrays
          const decodeValue = (value: unknown): number => {
            if (typeof value === 'string') {
              // If it's a base64 string
              const bytes = atob(value);
              let num = 0;
              for (let i = 0; i < bytes.length; i++) {
                num = num * 256 + bytes.charCodeAt(i);
              }
              return num;
            } else if (Array.isArray(value) && value.length > 0) {
              // If it's an array, use the first element
              return decodeValue(value[0]);
            }
            return 0;
          };

          const totalWorkers = decodeValue(returnValues[0]);
          const activeWorkers = decodeValue(returnValues[1]);
          const totalStake = decodeValue(returnValues[2]);

          console.log('✅ Pool stats retrieved:', { totalWorkers, activeWorkers, totalStake });

          return {
            totalWorkers,
            activeWorkers,
            totalStake
          };
        }
      }

      // Return default values if parsing fails
      console.warn('⚠️ Failed to parse pool stats, returning defaults');
      return {
        totalWorkers: 0,
        activeWorkers: 0,
        totalStake: 0
      };

    } catch (error) {
      console.error('❌ Error fetching pool stats:', error);
      // Return default values on error
      return {
        totalWorkers: 0,
        activeWorkers: 0,
        totalStake: 0
      };
    }
  }

  /**
   * Format stake amount from MIST to SUI
   */
  formatStake(mistAmount: number): string {
    const suiAmount = mistAmount / 1_000_000_000;
    return suiAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// Export singleton instance
export const workerRegistryService = new WorkerRegistryService();