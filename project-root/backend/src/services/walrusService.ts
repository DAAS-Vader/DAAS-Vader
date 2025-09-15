import axios, { AxiosResponse } from 'axios';
import { config } from '../config/index.js';
import { WalrusUploadResponse, ServiceError } from '../types/index.js';

export class WalrusService {
  private publisher: string;
  private aggregator: string;

  constructor() {
    this.publisher = config.walrus.publisher;
    this.aggregator = config.walrus.aggregator;
  }
  
  /**
   * Upload code bundle to Walrus
   */
  async uploadCodeBundle(codeBundle: Buffer): Promise<WalrusUploadResponse> {
    try {
      console.log(`🔄 Uploading ${codeBundle.length} bytes to Walrus Publisher: ${this.publisher}`);

      const response: AxiosResponse = await axios.put(
        `${this.publisher}/v1/blobs`,
        codeBundle,
        {
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          timeout: config.limits.requestTimeout,
          maxBodyLength: config.limits.codeBundleSize,
          maxContentLength: config.limits.codeBundleSize
        }
      );
      
      if (response.status !== 200) {
        throw new ServiceError(
          `Walrus upload failed: ${response.statusText}`,
          response.status
        );
      }
      
      console.log('✅ Walrus response:', JSON.stringify(response.data, null, 2));
      console.log('🔍 Response headers:', response.headers);
      console.log('📊 Status:', response.status);

      // Walrus API v1/blobs returns either:
      // { "newlyCreated": { "blobObject": { "id": "...", "blobId": "..." } } }
      // or { "alreadyCertified": { "blobId": "..." } }
      const { newlyCreated, alreadyCertified } = response.data;

      let blobId: string;
      if (newlyCreated?.blobObject?.blobId) {
        blobId = newlyCreated.blobObject.blobId;
      } else if (alreadyCertified?.blobId) {
        blobId = alreadyCertified.blobId;
      } else {
        throw new ServiceError(
          'Invalid response from Walrus: missing blob ID',
          502
        );
      }

      const cid = blobId;
      const size = codeBundle.length;
      
      return {
        cid,
        size
      };
      
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 502;
        const message = error.response?.data?.message || error.message;
        
        // Handle specific Walrus errors
        if (status === 413) {
          throw new ServiceError('Code bundle too large for Walrus storage', 413);
        }
        
        throw new ServiceError(`Walrus service error: ${message}`, status);
      }
      
      throw new ServiceError(`Walrus service connection failed: ${(error as Error).message}`, 502);
    }
  }
  
  /**
   * Retrieve blob from Walrus
   */
  async retrieveBlob(blobId: string): Promise<Buffer> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.aggregator}/v1/blobs/${blobId}`,
        {
          responseType: 'arraybuffer',
          timeout: config.limits.requestTimeout
        }
      );

      if (response.status !== 200) {
        throw new ServiceError(
          `Walrus retrieval failed: ${response.statusText}`,
          response.status
        );
      }

      return Buffer.from(response.data);

    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 502;
        const message = error.response?.data?.message || error.message;

        if (status === 404) {
          throw new ServiceError('Blob not found in Walrus storage', 404);
        }

        throw new ServiceError(`Walrus service error: ${message}`, status);
      }

      throw new ServiceError(`Walrus service connection failed: ${(error as Error).message}`, 502);
    }
  }
  
  /**
   * Check if blob exists in Walrus
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      const response = await axios.head(
        `${this.aggregator}/v1/blobs/${blobId}`,
        {
          timeout: 5000
        }
      );

      return response.status === 200;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }

      console.error('Walrus blob existence check failed:', (error as Error).message);
      return false;
    }
  }
  
  /**
   * Health check for Walrus publisher
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple connectivity test to publisher
      const response = await axios.get(`${this.publisher}/`, {
        timeout: 5000
      });

      return response.status === 200 || response.status === 404;  // 404 is OK, means server is responding

    } catch (error) {
      console.error('Walrus health check failed:', (error as Error).message);
      return false;
    }
  }
  
  /**
   * Get storage stats from Walrus aggregator
   */
  async getStorageStats(): Promise<any> {
    try {
      const response = await axios.get(`${this.aggregator}/v1/stats`, {
        timeout: 10000
      });

      return response.data;

    } catch (error) {
      console.error('Failed to get Walrus storage stats:', (error as Error).message);
      return null;
    }
  }
}