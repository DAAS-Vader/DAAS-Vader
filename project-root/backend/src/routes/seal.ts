import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, TicketRequest, ValidationError } from '../types/index.js';
import { SealService } from '../services/sealService.js';

const router = Router();

/**
 * POST /seal/ticket
 * 비밀 정보 복호화를 위한 시간 제한 티켓 생성
 */
router.post('/ticket', async (req: Request, res: Response) => {
  try {
    // const authReq = req as AuthenticatedRequest; // Removed for hackathon
    const { leaseId, cidEnv, nodeId }: TicketRequest = req.body;
    
    // Validate required fields
    if (!leaseId) {
      throw new ValidationError('leaseId is required');
    }
    
    if (!cidEnv) {
      throw new ValidationError('cidEnv is required');
    }
    
    if (!nodeId) {
      throw new ValidationError('nodeId is required');
    }
    
    // Validate CID format (basic check)
    if (!cidEnv.startsWith('bafy') && !cidEnv.startsWith('bafk')) {
      throw new ValidationError('Invalid cidEnv format');
    }
    
    // Seal 서비스 초기화
    const sealService = new SealService();
    
    // Generate ticket
    const ticketResponse = await sealService.generateTicket(leaseId, cidEnv, nodeId);
    
    console.log(`🎫 Generated ticket for lease ${leaseId}, node ${nodeId}`);
    
    res.status(200).json(ticketResponse);
    
  } catch (error) {
    console.error('Ticket generation error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'Ticket Generation Failed',
      message: 'Failed to generate decryption ticket'
    });
  }
});

/**
 * POST /seal/verify-ticket
 * 티켓 검증 (Seal 서비스가 호출하기 위한)
 */
router.post('/verify-ticket', async (req: Request, res: Response) => {
  try {
    const { ticket } = req.body;
    
    if (!ticket) {
      throw new ValidationError('ticket is required');
    }
    
    // Seal 서비스 초기화
    const sealService = new SealService();
    
    // Verify ticket
    const payload = await sealService.verifyTicket(ticket);
    
    console.log(`✅ Verified ticket for lease ${payload.leaseId}, node ${payload.nodeId}`);
    
    res.status(200).json({
      valid: true,
      payload
    });
    
  } catch (error) {
    console.error('Ticket verification error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
      return;
    }
    
    // For security, don't expose detailed error messages
    res.status(401).json({
      valid: false,
      error: 'Invalid or expired ticket'
    });
  }
});

/**
 * GET /seal/health
 * Seal 서비스 상태 확인
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const sealService = new SealService();
    const isHealthy = await sealService.healthCheck();
    
    if (isHealthy) {
      res.status(200).json({
        status: 'healthy',
        service: 'seal',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        service: 'seal',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Seal health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'seal',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;