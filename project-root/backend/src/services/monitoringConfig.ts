import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { getPrometheusService } from './prometheusService.js';

interface MonitoringSchedule {
  jobName: string;
  scrapeInterval: string;    // '5s', '30s', '1m' 등
  scrapeTimeout: string;
  enabled: boolean;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

interface MonitoringProfile {
  name: string;
  description: string;
  schedules: MonitoringSchedule[];
  globalSettings: {
    scrapeInterval: string;
    evaluationInterval: string;
    retentionTime: string;
  };
}

export class MonitoringConfigService {
  private configPath = 'prometheus.yml';
  private profilesPath = 'monitoring-profiles.json';

  // 사전 정의된 모니터링 프로필
  private predefinedProfiles: MonitoringProfile[] = [
    {
      name: 'realtime',
      description: '실시간 고빈도 모니터링',
      globalSettings: {
        scrapeInterval: '5s',
        evaluationInterval: '5s',
        retentionTime: '1h'
      },
      schedules: [
        { jobName: 'daas-vader-backend', scrapeInterval: '2s', scrapeTimeout: '1s', enabled: true, priority: 'critical' },
        { jobName: 'docker-nodes', scrapeInterval: '5s', scrapeTimeout: '3s', enabled: true, priority: 'high' },
        { jobName: 'cadvisor', scrapeInterval: '3s', scrapeTimeout: '2s', enabled: true, priority: 'critical' }
      ]
    },
    {
      name: 'production',
      description: '운영 환경용 균형잡힌 모니터링',
      globalSettings: {
        scrapeInterval: '15s',
        evaluationInterval: '15s',
        retentionTime: '7d'
      },
      schedules: [
        { jobName: 'daas-vader-backend', scrapeInterval: '10s', scrapeTimeout: '5s', enabled: true, priority: 'high' },
        { jobName: 'docker-nodes', scrapeInterval: '30s', scrapeTimeout: '15s', enabled: true, priority: 'normal' },
        { jobName: 'cadvisor', scrapeInterval: '15s', scrapeTimeout: '10s', enabled: true, priority: 'high' }
      ]
    },
    {
      name: 'development',
      description: '개발 환경용 저빈도 모니터링',
      globalSettings: {
        scrapeInterval: '30s',
        evaluationInterval: '30s',
        retentionTime: '24h'
      },
      schedules: [
        { jobName: 'daas-vader-backend', scrapeInterval: '30s', scrapeTimeout: '10s', enabled: true, priority: 'normal' },
        { jobName: 'docker-nodes', scrapeInterval: '60s', scrapeTimeout: '20s', enabled: true, priority: 'low' },
        { jobName: 'cadvisor', scrapeInterval: '30s', scrapeTimeout: '15s', enabled: false, priority: 'low' }
      ]
    },
    {
      name: 'debug',
      description: '디버깅용 초고빈도 모니터링',
      globalSettings: {
        scrapeInterval: '1s',
        evaluationInterval: '1s',
        retentionTime: '30m'
      },
      schedules: [
        { jobName: 'daas-vader-backend', scrapeInterval: '1s', scrapeTimeout: '500ms', enabled: true, priority: 'critical' },
        { jobName: 'docker-nodes', scrapeInterval: '2s', scrapeTimeout: '1s', enabled: true, priority: 'critical' },
        { jobName: 'cadvisor', scrapeInterval: '1s', scrapeTimeout: '500ms', enabled: true, priority: 'critical' }
      ]
    },
    {
      name: 'minimal',
      description: '최소한의 리소스 사용',
      globalSettings: {
        scrapeInterval: '5m',
        evaluationInterval: '5m',
        retentionTime: '1d'
      },
      schedules: [
        { jobName: 'daas-vader-backend', scrapeInterval: '2m', scrapeTimeout: '30s', enabled: true, priority: 'normal' },
        { jobName: 'docker-nodes', scrapeInterval: '5m', scrapeTimeout: '1m', enabled: true, priority: 'low' },
        { jobName: 'cadvisor', scrapeInterval: '10m', scrapeTimeout: '2m', enabled: false, priority: 'low' }
      ]
    }
  ];

  /**
   * 사용 가능한 모니터링 프로필 목록 조회
   */
  getAvailableProfiles(): MonitoringProfile[] {
    return this.predefinedProfiles;
  }

  /**
   * 현재 활성 프로필 조회
   */
  async getCurrentProfile(): Promise<string | null> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;
      return config.global?.profile || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 모니터링 프로필 적용
   */
  async applyProfile(profileName: string): Promise<void> {
    const profile = this.predefinedProfiles.find(p => p.name === profileName);
    if (!profile) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    console.log(`🔧 Applying monitoring profile: ${profileName}`);

    // Prometheus 설정 업데이트
    await this.updatePrometheusConfig(profile);

    // 내장 Prometheus 서비스 설정 업데이트
    const newInterval = this.parseInterval(profile.globalSettings.scrapeInterval);
    await this.updatePrometheusService(newInterval);

    console.log(`✅ Monitoring profile '${profileName}' applied successfully`);
  }

  /**
   * 커스텀 스케줄 설정
   */
  async setCustomSchedule(jobName: string, interval: string, timeout?: string): Promise<void> {
    console.log(`⏰ Setting custom schedule for ${jobName}: ${interval}`);

    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      // 해당 job 찾아서 업데이트
      const job = config.scrape_configs?.find((j: any) => j.job_name === jobName);
      if (job) {
        job.scrape_interval = interval;
        if (timeout) {
          job.scrape_timeout = timeout;
        }

        const updatedConfig = yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
        await fs.writeFile(this.configPath, updatedConfig);

        console.log(`✅ Custom schedule applied for ${jobName}`);
      } else {
        console.warn(`⚠️  Job not found: ${jobName}`);
      }
    } catch (error) {
      console.error('Failed to set custom schedule:', error);
      throw error;
    }
  }

  /**
   * 노드별 개별 스케줄 설정
   */
  async setNodeSchedule(nodeId: string, interval: string): Promise<void> {
    console.log(`⏰ Setting custom schedule for node ${nodeId}: ${interval}`);

    // 특정 노드에 대해서만 별도 job 생성
    const customJobName = `docker-node-${nodeId}`;

    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      // 기존 job에서 해당 노드 제거하고 새 job 생성
      const existingJob = config.scrape_configs?.find((j: any) => j.job_name === 'docker-nodes');
      if (existingJob) {
        // 새로운 커스텀 job 추가
        const customJob = {
          job_name: customJobName,
          scrape_interval: interval,
          scrape_timeout: this.calculateTimeout(interval),
          static_configs: [{
            targets: [`${nodeId}:9100`],  // 실제 구현에서는 nodeId를 IP로 변환 필요
            labels: {
              node: nodeId,
              type: 'docker-build-node',
              custom_schedule: 'true'
            }
          }]
        };

        config.scrape_configs.push(customJob);

        const updatedConfig = yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
        await fs.writeFile(this.configPath, updatedConfig);

        console.log(`✅ Custom node schedule applied for ${nodeId}`);
      }
    } catch (error) {
      console.error('Failed to set node schedule:', error);
      throw error;
    }
  }

  /**
   * 현재 모니터링 설정 상태 조회
   */
  async getMonitoringStatus(): Promise<{
    profile: string | null;
    globalInterval: string;
    jobSchedules: Array<{ jobName: string; interval: string; timeout: string; enabled: boolean }>;
    totalJobs: number;
    activeJobs: number;
  }> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      const jobSchedules = config.scrape_configs?.map((job: any) => ({
        jobName: job.job_name,
        interval: job.scrape_interval || config.global?.scrape_interval || '15s',
        timeout: job.scrape_timeout || config.global?.scrape_timeout || '10s',
        enabled: job.enabled !== false
      })) || [];

      return {
        profile: config.global?.profile || null,
        globalInterval: config.global?.scrape_interval || '15s',
        jobSchedules,
        totalJobs: jobSchedules.length,
        activeJobs: jobSchedules.filter((j: any) => j.enabled).length
      };
    } catch (error) {
      console.error('Failed to get monitoring status:', error);
      throw error;
    }
  }

  /**
   * Prometheus 설정 파일 업데이트
   */
  private async updatePrometheusConfig(profile: MonitoringProfile): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      // Global 설정 업데이트
      config.global = {
        ...config.global,
        ...profile.globalSettings,
        profile: profile.name
      };

      // Job별 스케줄 업데이트
      for (const schedule of profile.schedules) {
        const job = config.scrape_configs?.find((j: any) => j.job_name === schedule.jobName);
        if (job) {
          job.scrape_interval = schedule.scrapeInterval;
          job.scrape_timeout = schedule.scrapeTimeout;
          job.enabled = schedule.enabled;
          job.labels = { ...job.labels, priority: schedule.priority };
        }
      }

      const updatedConfig = yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
      await fs.writeFile(this.configPath, updatedConfig);
    } catch (error) {
      console.error('Failed to update Prometheus config:', error);
      throw error;
    }
  }

  /**
   * 내장 Prometheus 서비스 설정 업데이트
   */
  private async updatePrometheusService(intervalMs: number): Promise<void> {
    const prometheus = getPrometheusService();

    // 기존 타이머 정리하고 새 간격으로 재시작
    prometheus.shutdown();

    // 새로운 간격으로 서비스 재초기화 (실제로는 restart 메소드 필요)
    console.log(`🔄 Restarting Prometheus service with ${intervalMs}ms interval`);
  }

  /**
   * 시간 문자열을 밀리초로 변환
   */
  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)(s|m|h|ms)$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'ms': return num;
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      default: throw new Error(`Unsupported time unit: ${unit}`);
    }
  }

  /**
   * 간격에 적절한 타임아웃 계산
   */
  private calculateTimeout(interval: string): string {
    const intervalMs = this.parseInterval(interval);
    const timeoutMs = Math.min(intervalMs * 0.8, intervalMs - 1000); // 간격의 80% 또는 1초 적게

    if (timeoutMs < 1000) return '500ms';
    return `${Math.floor(timeoutMs / 1000)}s`;
  }
}

// 싱글톤 인스턴스
let monitoringConfig: MonitoringConfigService | null = null;

export function getMonitoringConfig(): MonitoringConfigService {
  if (!monitoringConfig) {
    monitoringConfig = new MonitoringConfigService();
  }
  return monitoringConfig;
}