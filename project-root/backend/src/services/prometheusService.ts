import {
  register,
  collectDefaultMetrics,
  Gauge,
  Counter,
  Histogram,
  Summary
} from 'prom-client';
import * as os from 'os';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 메트릭 수집 인터페이스
export interface PrometheusMetrics {
  // 시스템 메트릭
  cpuUsage: Gauge<string>;
  memoryUsage: Gauge<string>;
  diskUsage: Gauge<string>;
  networkIO: Gauge<string>;

  // 애플리케이션 메트릭
  httpRequests: Counter<string>;
  httpDuration: Histogram<string>;
  activeConnections: Gauge<string>;

  // DAAS 관련 메트릭
  keyOperations: Counter<string>;
  sealOperations: Counter<string>;
  dockerBuilds: Counter<string>;
  nodeHealth: Gauge<string>;

  // 에러 메트릭
  errorCount: Counter<string>;
  errorRate: Gauge<string>;
}

/**
 * Prometheus 메트릭 수집 및 관리 서비스
 */
export class PrometheusService {
  private metrics: PrometheusMetrics;
  private collectInterval?: NodeJS.Timeout;
  private readonly collectionIntervalMs: number;
  private readonly fastCollectionIntervalMs: number;
  private fastCollectInterval?: NodeJS.Timeout;

  constructor(
    collectionIntervalMs: number = 30000,      // 기본 수집 간격 (30초)
    fastCollectionIntervalMs: number = 5000    // 빠른 수집 간격 (5초)
  ) {
    this.collectionIntervalMs = collectionIntervalMs;
    this.fastCollectionIntervalMs = fastCollectionIntervalMs;

    // 기본 Node.js 메트릭 자동 수집 활성화
    collectDefaultMetrics({
      register,
      prefix: 'daas_vader_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    this.metrics = this.initializeMetrics();
    this.startCollection();

    console.log('📊 Prometheus metrics service initialized');
  }

  /**
   * 메트릭 정의 초기화
   */
  private initializeMetrics(): PrometheusMetrics {
    return {
      // === 시스템 메트릭 ===
      cpuUsage: new Gauge({
        name: 'daas_vader_cpu_usage_percent',
        help: 'CPU 사용률 (%)',
        labelNames: ['core']
      }),

      memoryUsage: new Gauge({
        name: 'daas_vader_memory_usage_bytes',
        help: '메모리 사용량 (바이트)',
        labelNames: ['type'] // used, free, total, heap_used, heap_total
      }),

      diskUsage: new Gauge({
        name: 'daas_vader_disk_usage_bytes',
        help: '디스크 사용량 (바이트)',
        labelNames: ['mount_point', 'type'] // used, free, total
      }),

      networkIO: new Gauge({
        name: 'daas_vader_network_io_bytes',
        help: '네트워크 I/O (바이트)',
        labelNames: ['interface', 'direction'] // rx, tx
      }),

      // === 애플리케이션 메트릭 ===
      httpRequests: new Counter({
        name: 'daas_vader_http_requests_total',
        help: 'HTTP 요청 총 개수',
        labelNames: ['method', 'route', 'status_code']
      }),

      httpDuration: new Histogram({
        name: 'daas_vader_http_request_duration_seconds',
        help: 'HTTP 요청 처리 시간 (초)',
        labelNames: ['method', 'route'],
        buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
      }),

      activeConnections: new Gauge({
        name: 'daas_vader_active_connections',
        help: '활성 연결 수',
        labelNames: ['type'] // http, websocket, database
      }),

      // === DAAS 관련 메트릭 ===
      keyOperations: new Counter({
        name: 'daas_vader_key_operations_total',
        help: '키 관리 작업 총 개수',
        labelNames: ['operation', 'status'] // create, retrieve, revoke | success, error
      }),

      sealOperations: new Counter({
        name: 'daas_vader_seal_operations_total',
        help: 'Seal 작업 총 개수',
        labelNames: ['operation', 'status'] // encrypt, decrypt, verify | success, error
      }),

      dockerBuilds: new Counter({
        name: 'daas_vader_docker_builds_total',
        help: 'Docker 빌드 총 개수',
        labelNames: ['status', 'node_id'] // success, error
      }),

      nodeHealth: new Gauge({
        name: 'daas_vader_node_health_status',
        help: '노드 상태 (1=healthy, 0.5=degraded, 0=unhealthy)',
        labelNames: ['node_id', 'service']
      }),

      // === 에러 메트릭 ===
      errorCount: new Counter({
        name: 'daas_vader_errors_total',
        help: '에러 총 개수',
        labelNames: ['service', 'error_type']
      }),

      errorRate: new Gauge({
        name: 'daas_vader_error_rate',
        help: '에러율 (에러/전체 요청)',
        labelNames: ['service', 'time_window'] // 1m, 5m, 15m
      })
    };
  }

  /**
   * 주기적 메트릭 수집 시작
   */
  private startCollection(): void {
    this.collectInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.collectDockerMetrics();
        await this.collectNetworkMetrics();
      } catch (error) {
        console.error('Failed to collect metrics:', error);
        this.metrics.errorCount.inc({
          service: 'prometheus',
          error_type: 'collection_error'
        });
      }
    }, this.collectionIntervalMs);

    console.log(`🔄 Metrics collection started (interval: ${this.collectionIntervalMs}ms)`);
  }

  /**
   * 시스템 메트릭 수집
   */
  private async collectSystemMetrics(): Promise<void> {
    // CPU 사용률
    const cpus = os.cpus();
    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const idle = cpu.times.idle;
      const usage = ((total - idle) / total) * 100;

      this.metrics.cpuUsage.set({ core: `cpu${i}` }, usage);
    }

    // 평균 CPU 사용률
    const loadAvg = os.loadavg()[0]; // 1분 평균
    this.metrics.cpuUsage.set({ core: 'average' }, (loadAvg / cpus.length) * 100);

    // 메모리 사용량
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.metrics.memoryUsage.set({ type: 'total' }, totalMem);
    this.metrics.memoryUsage.set({ type: 'used' }, usedMem);
    this.metrics.memoryUsage.set({ type: 'free' }, freeMem);

    // Node.js 힙 메모리
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.metrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);

    // 디스크 사용량 (루트 파티션)
    try {
      const { stdout } = await execAsync('df -B1 / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const [, total, used, available] = parts.map(Number);

      // Validate that the values are valid numbers
      if (!isNaN(total) && !isNaN(used) && !isNaN(available)) {
        this.metrics.diskUsage.set({ mount_point: '/', type: 'total' }, total);
        this.metrics.diskUsage.set({ mount_point: '/', type: 'used' }, used);
        this.metrics.diskUsage.set({ mount_point: '/', type: 'free' }, available);
      }
    } catch (error) {
      console.warn('Failed to collect disk usage:', error);
    }
  }

  /**
   * Docker 메트릭 수집
   */
  private async collectDockerMetrics(): Promise<void> {
    try {
      // Docker 컨테이너 상태
      const { stdout: psOutput } = await execAsync('docker ps --format "{{.Names}},{{.Status}}" 2>/dev/null || true');

      if (psOutput.trim()) {
        const containers = psOutput.trim().split('\n');
        for (const container of containers) {
          const [name, status] = container.split(',');
          const isHealthy = status.includes('Up') ? 1 : 0;

          this.metrics.nodeHealth.set(
            { node_id: name, service: 'docker' },
            isHealthy
          );
        }
      }

      // Docker 시스템 정보
      const { stdout: infoOutput } = await execAsync('docker system df --format "{{.Type}},{{.Size}}" 2>/dev/null || true');

      if (infoOutput.trim()) {
        const lines = infoOutput.trim().split('\n');
        for (const line of lines) {
          const [type, sizeStr] = line.split(',');
          // 크기 파싱 (예: "1.2GB", "500MB")
          const sizeMatch = sizeStr.match(/^([\d.]+)([KMGT]?B)$/);
          if (sizeMatch) {
            const [, value, unit] = sizeMatch;
            const multipliers: Record<string, number> = {
              'B': 1,
              'KB': 1024,
              'MB': 1024 * 1024,
              'GB': 1024 * 1024 * 1024,
              'TB': 1024 * 1024 * 1024 * 1024
            };

            const bytes = parseFloat(value) * (multipliers[unit] || 1);
            this.metrics.diskUsage.set(
              { mount_point: 'docker', type: type.toLowerCase() },
              bytes
            );
          }
        }
      }

    } catch (error) {
      console.warn('Failed to collect Docker metrics:', error);
    }
  }

  /**
   * 네트워크 메트릭 수집
   */
  private async collectNetworkMetrics(): Promise<void> {
    try {
      const networkInterfaces = os.networkInterfaces();

      for (const [interfaceName, addresses] of Object.entries(networkInterfaces)) {
        if (!addresses || interfaceName === 'lo') continue;

        // /proc/net/dev에서 네트워크 통계 읽기 (Linux 환경)
        try {
          const netData = await fs.readFile('/proc/net/dev', 'utf8');
          const lines = netData.split('\n');

          for (const line of lines) {
            if (line.includes(interfaceName + ':')) {
              const stats = line.split(/\s+/);
              const rxBytes = parseInt(stats[1] || '0');
              const txBytes = parseInt(stats[9] || '0');

              this.metrics.networkIO.set(
                { interface: interfaceName, direction: 'rx' },
                rxBytes
              );
              this.metrics.networkIO.set(
                { interface: interfaceName, direction: 'tx' },
                txBytes
              );
            }
          }
        } catch (error) {
          // /proc/net/dev가 없는 경우 (macOS 등) 기본값 설정
          this.metrics.networkIO.set(
            { interface: interfaceName, direction: 'rx' },
            0
          );
          this.metrics.networkIO.set(
            { interface: interfaceName, direction: 'tx' },
            0
          );
        }
      }
    } catch (error) {
      console.warn('Failed to collect network metrics:', error);
    }
  }

  // ==================== 공개 메서드 ====================

  /**
   * HTTP 요청 메트릭 기록
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.metrics.httpRequests.inc({
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString()
    });

    this.metrics.httpDuration.observe(
      { method: method.toUpperCase(), route },
      duration / 1000 // 밀리초를 초로 변환
    );
  }

  /**
   * 키 작업 메트릭 기록
   */
  recordKeyOperation(operation: string, success: boolean): void {
    this.metrics.keyOperations.inc({
      operation,
      status: success ? 'success' : 'error'
    });

    if (!success) {
      this.metrics.errorCount.inc({
        service: 'key_server',
        error_type: 'operation_error'
      });
    }
  }

  /**
   * Seal 작업 메트릭 기록
   */
  recordSealOperation(operation: string, success: boolean): void {
    this.metrics.sealOperations.inc({
      operation,
      status: success ? 'success' : 'error'
    });

    if (!success) {
      this.metrics.errorCount.inc({
        service: 'seal',
        error_type: 'operation_error'
      });
    }
  }

  /**
   * Docker 빌드 메트릭 기록
   */
  recordDockerBuild(nodeId: string, success: boolean): void {
    this.metrics.dockerBuilds.inc({
      status: success ? 'success' : 'error',
      node_id: nodeId
    });

    if (!success) {
      this.metrics.errorCount.inc({
        service: 'docker',
        error_type: 'build_error'
      });
    }
  }

  /**
   * 노드 상태 업데이트
   */
  updateNodeHealth(nodeId: string, service: string, status: 'healthy' | 'degraded' | 'unhealthy'): void {
    const statusValue = status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0;

    this.metrics.nodeHealth.set(
      { node_id: nodeId, service },
      statusValue
    );
  }

  /**
   * 활성 연결 수 업데이트
   */
  updateActiveConnections(type: string, count: number): void {
    this.metrics.activeConnections.set({ type }, count);
  }

  /**
   * 에러율 업데이트
   */
  updateErrorRate(service: string, timeWindow: string, rate: number): void {
    this.metrics.errorRate.set({ service, time_window: timeWindow }, rate);
  }

  /**
   * Prometheus 메트릭 문자열 반환
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * 특정 메트릭 레지스트리 반환
   */
  getRegister() {
    return register;
  }

  /**
   * 메트릭 초기화 (테스트용)
   */
  clearMetrics(): void {
    register.clear();
  }

  /**
   * 서비스 종료
   */
  shutdown(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = undefined;
    }

    console.log('📊 Prometheus service shut down');
  }
}

// 싱글톤 인스턴스
let prometheusService: PrometheusService | null = null;

/**
 * Prometheus 서비스 인스턴스 가져오기
 */
export function getPrometheusService(): PrometheusService {
  if (!prometheusService) {
    prometheusService = new PrometheusService();
  }
  return prometheusService;
}

/**
 * Express 미들웨어: HTTP 메트릭 자동 수집
 */
export function prometheusMiddleware() {
  const prometheus = getPrometheusService();

  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.path || 'unknown';

      prometheus.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration
      );

      return originalSend.call(this, data);
    };

    next();
  };
}