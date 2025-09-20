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
      console.log('📦 Package ID:', PACKAGE_ID);
      console.log('📝 Registry ID:', WORKER_REGISTRY_ID);

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

      console.log('📊 Full result:', JSON.stringify(result, null, 2));

      // Parse the return values
      if (result.results && result.results.length > 0) {
        console.log('📊 Results found:', result.results.length);
        const firstResult = result.results[0];
        console.log('📊 First result:', firstResult);

        if (firstResult.returnValues && firstResult.returnValues.length >= 3) {
          console.log('📊 Return values found:', firstResult.returnValues.length);
          console.log('📊 Return values:', firstResult.returnValues);

          // The function returns (u64, u64, u64) as three separate values
          // Each value is in format: [[byte_array], "u64"]
          const decodeU64FromReturnValue = (value: unknown): number => {
            if (Array.isArray(value) && value.length === 2) {
              const [bytes, type] = value;
              if (type === 'u64' && Array.isArray(bytes)) {
                // Little-endian decoding of u64
                let result = 0;
                for (let i = 0; i < bytes.length && i < 8; i++) {
                  result += bytes[i] * Math.pow(256, i);
                }
                return result;
              }
            }
            return 0;
          };

          const totalWorkers = decodeU64FromReturnValue(firstResult.returnValues[0]);
          const activeWorkers = decodeU64FromReturnValue(firstResult.returnValues[1]);
          const totalStake = decodeU64FromReturnValue(firstResult.returnValues[2]);

          console.log('✅ Decoded pool stats:', { totalWorkers, activeWorkers, totalStake });

          return {
            totalWorkers,
            activeWorkers,
            totalStake
          };
        }
      } else {
        console.log('⚠️ No results returned from devInspect');
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
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      // Return default values on error
      return {
        totalWorkers: 0,
        activeWorkers: 0,
        totalStake: 0
      };
    }
  }

  /**
   * Get individual worker's stake amount
   * Calls get_worker_stake(registry: &WorkerRegistry, node_id: String): u64
   */
  async getWorkerStake(nodeId: string): Promise<number> {
    try {
      console.log('💰 Fetching stake for worker:', nodeId);

      // Create a transaction to call the view function
      const tx = new Transaction();

      // Call the get_worker_stake function
      tx.moveCall({
        target: `${PACKAGE_ID}::worker_registry::get_worker_stake`,
        arguments: [
          tx.object(WORKER_REGISTRY_ID),
          tx.pure.string(nodeId)
        ],
      });

      // Execute the transaction in dev inspect mode (read-only)
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

      console.log('💰 Worker stake result:', result);

      // Parse the return value
      if (result.results && result.results.length > 0) {
        const firstResult = result.results[0];
        if (firstResult.returnValues && firstResult.returnValues.length > 0) {
          const returnValue = firstResult.returnValues[0];

          // Decode u64 value
          if (Array.isArray(returnValue) && returnValue.length === 2) {
            const [bytes, type] = returnValue;
            if (type === 'u64' && Array.isArray(bytes)) {
              let stake = 0;
              for (let i = 0; i < bytes.length && i < 8; i++) {
                stake += bytes[i] * Math.pow(256, i);
              }
              console.log('✅ Worker stake retrieved:', stake);
              return stake;
            }
          }
        }
      }

      console.warn('⚠️ Failed to get worker stake, returning 0');
      return 0;

    } catch (error) {
      console.error('❌ Error fetching worker stake:', error);
      if (error instanceof Error && error.message.includes('AbortError')) {
        // Worker not found
        console.log('🔍 Worker not found with ID:', nodeId);
      }
      return 0;
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