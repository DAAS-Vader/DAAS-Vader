import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { SealEncryptResponse, TicketResponse, ServiceError } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class SealService {
  private baseURL: string;
  private serviceToken: string;
  private ticketSecret: string;
  
  constructor() {
    this.baseURL = config.seal.url;
    this.serviceToken = config.seal.serviceToken;
    this.ticketSecret = config.seal.ticketSecret;
  }
  
  /**
   * Encrypt and upload secrets to Walrus via Seal
   */
  async encryptAndUpload(secretBundle: Buffer): Promise<SealEncryptResponse> {
    try {
      const formData = new FormData();
      formData.append('file', secretBundle, {
        filename: 'secrets.tar.gz',
        contentType: 'application/gzip'
      });
      
      // Set Walrus as the target storage
      formData.append('target', `walrus://${config.walrus.publisher.replace('https://', '')}`);
      
      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/v1/encrypt-and-upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: config.limits.requestTimeout
        }
      );
      
      if (response.status !== 200) {
        throw new ServiceError(
          `Seal encrypt-and-upload failed: ${response.statusText}`,
          response.status
        );
      }
      
      const { cid, dek_version } = response.data;
      
      if (!cid || !dek_version) {
        throw new ServiceError(
          'Invalid response from Seal service: missing cid or dek_version',
          502
        );
      }
      
      return {
        cid,
        dek_version
      };
      
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 502;
        const message = error.response?.data?.message || error.message;
        throw new ServiceError(`Seal service error: ${message}`, status);
      }
      
      throw new ServiceError(`Seal service connection failed: ${(error as Error).message}`, 502);
    }
  }
  
  /**
   * Generate a time-limited ticket for secret decryption
   */
  async generateTicket(leaseId: string, cidEnv: string, nodeId: string): Promise<TicketResponse> {
    try {
      // Generate unique JTI (JWT ID) for single-use ticket
      const jti = uuidv4();
      
      // Ticket expires in 5 minutes (300 seconds)
      const exp = Math.floor(Date.now() / 1000) + 300;
      
      // Create JWT payload
      const payload = {
        leaseId,
        cidEnv,
        nodeId,
        exp,
        jti,
        iat: Math.floor(Date.now() / 1000)
      };
      
      // Sign the ticket with shared secret
      const ticket = jwt.sign(payload, this.ticketSecret, {
        algorithm: 'HS256'
      });

      // TODO: Store JTI for single-use validation (DB disabled for hackathon)
      console.log('⚠️ JTI storage disabled - ticket can be reused');

      return {
        ticket,
        exp,
        jti
      };

    } catch (error) {
      throw new ServiceError(
        `Failed to generate ticket: ${(error as Error).message}`,
        500
      );
    }
  }
  
  /**
   * Verify a ticket (for Seal service to validate)
   */
  async verifyTicket(ticket: string): Promise<any> {
    try {
      // Verify JWT signature
      const payload = jwt.verify(ticket, this.ticketSecret, {
        algorithms: ['HS256']
      }) as any;
      
      // TODO: Check if ticket exists and is not expired (DB disabled for hackathon)
      console.log('⚠️ Ticket validation disabled - accepting all valid signatures');

      // Check expiration time from JWT payload
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new ServiceError('Ticket has expired', 401);
      }
      
      return payload;
      
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ServiceError('Invalid ticket signature', 401);
      }
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new ServiceError('Ticket has expired', 401);
      }
      
      if (error instanceof ServiceError) {
        throw error;
      }
      
      throw new ServiceError(`Ticket verification failed: ${(error as Error).message}`, 500);
    }
  }
  
  /**
   * Health check for Seal service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      
      return response.status === 200;
      
    } catch (error) {
      console.error('Seal health check failed:', (error as Error).message);
      return false;
    }
  }
}