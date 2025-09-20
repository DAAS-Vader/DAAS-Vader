import { Router, Request, Response } from 'express';
import { getMonitoringConfig } from '../services/monitoringConfig.js';
import { ValidationError } from '../types/index.js';

const router = Router();

/**
 * GET /monitoring-config/profiles
 * 사용 가능한 모니터링 프로필 목록 조회
 */
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const config = getMonitoringConfig();
    const profiles = config.getAvailableProfiles();

    res.status(200).json({
      success: true,
      profiles: profiles.map(p => ({
        name: p.name,
        description: p.description,
        globalSettings: p.globalSettings,
        jobCount: p.schedules.length
      }))
    });

  } catch (error) {
    console.error('Profiles retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Profiles Retrieval Failed',
      message: 'Failed to retrieve monitoring profiles'
    });
  }
});

/**
 * GET /monitoring-config/status
 * 현재 모니터링 설정 상태 조회
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const config = getMonitoringConfig();
    const status = await config.getMonitoringStatus();

    res.status(200).json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Status Retrieval Failed',
      message: 'Failed to retrieve monitoring status'
    });
  }
});

/**
 * POST /monitoring-config/profile/:profileName
 * 모니터링 프로필 적용
 */
router.post('/profile/:profileName', async (req: Request, res: Response) => {
  try {
    const { profileName } = req.params;
    const config = getMonitoringConfig();

    await config.applyProfile(profileName);

    res.status(200).json({
      success: true,
      message: `Monitoring profile '${profileName}' applied successfully`,
      profileName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Profile application error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'Profile Not Found',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Profile Application Failed',
      message: 'Failed to apply monitoring profile'
    });
  }
});

/**
 * POST /monitoring-config/schedule/job
 * 특정 Job의 수집 스케줄 설정
 */
router.post('/schedule/job', async (req: Request, res: Response) => {
  try {
    const { jobName, interval, timeout } = req.body;

    if (!jobName || typeof jobName !== 'string') {
      throw new ValidationError('Job name is required');
    }

    if (!interval || typeof interval !== 'string') {
      throw new ValidationError('Interval is required (e.g., "30s", "1m")');
    }

    // 간격 형식 검증
    if (!/^\d+(ms|s|m|h)$/.test(interval)) {
      throw new ValidationError('Invalid interval format. Use format like "30s", "1m", "5h"');
    }

    const config = getMonitoringConfig();
    await config.setCustomSchedule(jobName, interval, timeout);

    res.status(200).json({
      success: true,
      message: `Schedule updated for job '${jobName}'`,
      jobName,
      interval,
      timeout,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Job schedule error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Schedule Update Failed',
      message: 'Failed to update job schedule'
    });
  }
});

/**
 * POST /monitoring-config/schedule/node
 * 특정 노드의 수집 스케줄 설정
 */
router.post('/schedule/node', async (req: Request, res: Response) => {
  try {
    const { nodeId, interval } = req.body;

    if (!nodeId || typeof nodeId !== 'string') {
      throw new ValidationError('Node ID is required');
    }

    if (!interval || typeof interval !== 'string') {
      throw new ValidationError('Interval is required (e.g., "30s", "1m")');
    }

    // 간격 형식 검증
    if (!/^\d+(ms|s|m|h)$/.test(interval)) {
      throw new ValidationError('Invalid interval format. Use format like "30s", "1m", "5h"');
    }

    const config = getMonitoringConfig();
    await config.setNodeSchedule(nodeId, interval);

    res.status(200).json({
      success: true,
      message: `Custom schedule set for node '${nodeId}'`,
      nodeId,
      interval,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Node schedule error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Node Schedule Failed',
      message: 'Failed to set node schedule'
    });
  }
});

/**
 * GET /monitoring-config/intervals
 * 권장 모니터링 간격 가이드
 */
router.get('/intervals', (req: Request, res: Response) => {
  try {
    const recommendations = {
      critical_systems: {
        description: '중요한 시스템 (결제, 인증)',
        recommended_intervals: {
          metrics: '1s-5s',
          alerts: '1s',
          retention: '1h-1d'
        }
      },
      production_apps: {
        description: '운영 애플리케이션',
        recommended_intervals: {
          metrics: '10s-30s',
          alerts: '15s',
          retention: '7d-30d'
        }
      },
      development: {
        description: '개발 환경',
        recommended_intervals: {
          metrics: '30s-60s',
          alerts: '60s',
          retention: '1d-3d'
        }
      },
      background_services: {
        description: '백그라운드 서비스',
        recommended_intervals: {
          metrics: '1m-5m',
          alerts: '5m',
          retention: '1d-7d'
        }
      },
      resource_monitoring: {
        description: '리소스 모니터링 (CPU, 메모리)',
        recommended_intervals: {
          metrics: '15s-30s',
          alerts: '1m',
          retention: '7d'
        }
      }
    };

    res.status(200).json({
      success: true,
      recommendations,
      notes: [
        '짧은 간격일수록 더 정확하지만 리소스 사용량이 증가합니다',
        'Alert 간격은 메트릭 간격보다 같거나 길어야 합니다',
        'Retention 시간이 길수록 저장 공간이 더 필요합니다',
        '운영 환경에서는 15s-30s 간격을 권장합니다'
      ]
    });

  } catch (error) {
    console.error('Intervals guide error:', error);
    res.status(500).json({
      success: false,
      error: 'Guide Retrieval Failed',
      message: 'Failed to retrieve intervals guide'
    });
  }
});

/**
 * POST /monitoring-config/reload
 * Prometheus 설정 리로드 (Hot Reload)
 */
router.post('/reload', async (req: Request, res: Response) => {
  try {
    // Prometheus에 SIGHUP 신호 전송하여 설정 리로드
    // 실제 환경에서는 Prometheus 인스턴스에 HTTP POST /-/reload 요청

    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';

    try {
      const response = await fetch(`${prometheusUrl}/-/reload`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        res.status(200).json({
          success: true,
          message: 'Prometheus configuration reloaded successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(`Prometheus reload failed: ${response.status}`);
      }
    } catch (fetchError) {
      // Prometheus API 호출 실패 시 로컬 방법 시도
      console.warn('Prometheus API reload failed, configuration updated locally');
      res.status(200).json({
        success: true,
        message: 'Configuration updated (manual Prometheus restart may be required)',
        note: 'Prometheus may need manual restart to apply changes',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Reload error:', error);
    res.status(500).json({
      success: false,
      error: 'Reload Failed',
      message: 'Failed to reload Prometheus configuration'
    });
  }
});

export default router;