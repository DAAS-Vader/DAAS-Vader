import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../types/index.js';

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
      // For dev token, use dummy wallet address
      (req as AuthenticatedRequest).walletAddress = '0x742d35Cc6634C0532925a3b8D2Aa2e5a';
      next();
      return;
    }
    
    // TODO: Implement zkLogin authentication when ready
    // This is where we'll validate zkLogin proofs and extract SUI address
    
    res.status(401).json({ 
      error: 'Invalid token',
      message: 'Token authentication failed' 
    });
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication' 
    });
  }
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
    const authReq = req as AuthenticatedRequest;

    // Skip validation for dev token (already has dummy address)
    if (authReq.walletAddress === '0x742d35Cc6634C0532925a3b8D2Aa2e5a') {
      next();
      return;
    }

    // Validate wallet address format (basic validation)
    const walletAddressPattern = /^0x[a-fA-F0-9]+$/;
    if (!authReq.walletAddress || !walletAddressPattern.test(authReq.walletAddress)) {
      res.status(401).json({
        error: 'Invalid wallet address',
        message: 'Wallet address format is invalid'
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