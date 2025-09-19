import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import crypto from 'crypto';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Please provide a valid Bearer token'
      });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // For MVP, use simple dev token authentication
    if (token === config.auth.devAdminToken) {
      // Dev token requires walletAddress to be provided in request body or headers
      const walletFromBody = req.body?.walletAddress;
      const walletFromHeader = req.headers['x-wallet-address'] as string;
      const devWallet = walletFromBody || walletFromHeader;

      if (!devWallet || !isValidWalletAddress(devWallet)) {
        res.status(401).json({
          error: 'Dev token requires valid wallet address',
          message: 'Please provide walletAddress in request body or x-wallet-address header'
        });
        return;
      }

      (req as unknown as AuthenticatedRequest).walletAddress = devWallet;
      next();
      return;
    }

    // Try to parse wallet signature authentication
    try {
      const authData = JSON.parse(token);
      const { walletAddress, signature, message, timestamp } = authData;

      // Validate wallet signature authentication
      if (await validateWalletSignature(walletAddress, signature, message, timestamp)) {
        (req as unknown as AuthenticatedRequest).walletAddress = walletAddress;
        next();
        return;
      }
    } catch (parseError) {
      // If not JSON, might be legacy format or invalid
      console.log('Token is not valid JSON, checking legacy format');
    }

    // Check if token looks like a wallet address (legacy support)
    if (isValidWalletAddress(token)) {
      console.warn('Using legacy wallet address as token. This should be replaced with proper signature authentication.');
      (req as unknown as AuthenticatedRequest).walletAddress = token;
      next();
      return;
    }

    res.status(401).json({
      error: 'Invalid token',
      message: 'Token authentication failed. Please provide a valid wallet signature or dev token.'
    });

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
}

// Wallet signature validation
export async function validateWalletSignature(
  walletAddress: string,
  signature: string,
  message: string,
  timestamp: number
): Promise<boolean> {
  try {
    // Validate timestamp (signature should be fresh within 5 minutes)
    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp);
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (timeDiff > FIVE_MINUTES) {
      console.warn('Signature timestamp is too old');
      return false;
    }

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      console.warn('Invalid wallet address format');
      return false;
    }

    // Validate message format
    const expectedMessage = `DaaS Authentication\nTimestamp: ${timestamp}\nWallet: ${walletAddress}`;
    if (message !== expectedMessage) {
      console.warn('Message format mismatch');
      return false;
    }

    // TODO: Implement actual SUI signature verification
    // For now, we'll accept any properly formatted signature as valid
    // In production, this should use SUI SDK to verify the signature
    console.log('Wallet signature validation - using placeholder verification');

    return typeof signature === 'string' && signature.length > 0;
  } catch (error) {
    console.error('Error validating wallet signature:', error);
    return false;
  }
}

// Helper function to validate wallet address format
function isValidWalletAddress(address: string): boolean {
  // SUI addresses are 32 bytes (64 hex chars) with 0x prefix
  const suiAddressPattern = /^0x[a-fA-F0-9]{64}$/;
  return suiAddressPattern.test(address);
}

// Future zkLogin authentication function
export async function zkLoginAuth(
  zkProof: string,
  nonce: string
): Promise<string | null> {
  // TODO: Implement zkLogin verification
  // 1. Verify the zkLogin proof
  // 2. Extract SUI address from proof
  // 3. Return wallet address directly (no database user needed)

  return null; // Placeholder
}

// Middleware to validate wallet address format
export async function validateWalletAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as unknown as AuthenticatedRequest;

    // All wallet addresses should be validated - no special cases

    // Validate wallet address format using the helper function
    if (!authReq.walletAddress || !isValidWalletAddress(authReq.walletAddress)) {
      res.status(401).json({
        error: 'Invalid wallet address',
        message: 'Wallet address format is invalid. SUI addresses must be 64 hex characters with 0x prefix.'
      });
      return;
    }

    next();

  } catch (error) {
    console.error('Wallet address validation error:', error);
    res.status(500).json({
      error: 'Wallet validation error',
      message: 'Internal server error during wallet validation'
    });
  }
}