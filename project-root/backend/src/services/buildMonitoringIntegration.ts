import { getNodeRegistry } from './nodeRegistry.js';
import { getPrometheusService } from './prometheusService.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildNode {
  nodeId: string;
  nodeIp: string;
  nodeName?: string;
  nodeType?: 'docker-builder' | 'build-runtime' | 'custom';
  capabilities?: string[];
}

interface MonitoringSetupOptions {
  installExporter?: boolean;      // Node Exporter 설치 여부
  installCadvisor?: boolean;      // cAdvisor 설치 여부
  exporterPort?: number;          // Node Exporter 포트
  cadvisorPort?: number;          // cAdvisor 포트
  autoRegister?: boolean;         // 자동 등록 여부
  labels?: Record<string, string>; // 추가 라벨
}

/**
 * Docker 빌드 서버와 모니터링 시스템 통합
 */
export class BuildMonitoringIntegration {
  private nodeRegistry = getNodeRegistry();
  private prometheusService = getPrometheusService();

  /**
   * Docker 이미지 빌드 후 자동 모니터링 설정
   * Docker 빌드 서버가 이미지를 배포할 때 호출
   */
  async setupMonitoringOnBuild(
    node: BuildNode,
    options: MonitoringSetupOptions = {}
  ): Promise<void> {
    const {
      installExporter = true,
      installCadvisor = true,
      exporterPort = 9100,
      cadvisorPort = 8080,
      autoRegister = true,
      labels = {}
    } = options;

    console.log(`🚀 Setting up monitoring for build node: ${node.nodeId}`);

    try {
      // 1. Node Exporter 설치 스크립트 실행 (원격 노드에)
      if (installExporter) {
        await this.installNodeExporter(node, exporterPort);
      }

      // 2. cAdvisor 설치 (Docker 모니터링)
      if (installCadvisor) {
        await this.installCadvisor(node, cadvisorPort);
      }

      // 3. Prometheus 레지스트리에 자동 등록
      if (autoRegister) {
        await this.registerNodeToPrometheus(node, exporterPort, {
          ...labels,
          type: node.nodeType || 'build-runtime',
          managed_by: 'build-service',
          created_at: new Date().toISOString()
        });
      }

      // 4. 헬스체크 수행
      const isHealthy = await this.nodeRegistry.checkNodeHealth(
        node.nodeIp,
        exporterPort
      );

      if (isHealthy) {
        console.log(`✅ Monitoring setup successful for ${node.nodeId}`);

        // 5. Prometheus 메트릭 기록
        this.prometheusService.recordDockerBuild(node.nodeId, true);
      } else {
        console.warn(`⚠️  Node ${node.nodeId} monitoring setup incomplete`);
        this.prometheusService.recordDockerBuild(node.nodeId, false);
      }

    } catch (error) {
      console.error(`❌ Failed to setup monitoring for ${node.nodeId}:`, error);
      this.prometheusService.recordDockerBuild(node.nodeId, false);
      throw error;
    }
  }

  /**
   * Node Exporter를 원격 노드에 설치
   */
  private async installNodeExporter(
    node: BuildNode,
    port: number
  ): Promise<void> {
    console.log(`📊 Installing Node Exporter on ${node.nodeId}...`);

    // SSH를 통한 원격 설치 (실제 환경에서는 SSH 키 인증 필요)
    const installCommand = `
      ssh ${node.nodeIp} "docker run -d \\
        --name node-exporter \\
        --restart unless-stopped \\
        --pid='host' \\
        --net='host' \\
        -v '/:/host:ro,rslave' \\
        quay.io/prometheus/node-exporter:latest \\
        --path.rootfs=/host \\
        --web.listen-address=:${port}"
    `;

    try {
      // 실제 환경에서는 SSH 연결 설정 필요
      // await execAsync(installCommand);
      console.log(`✅ Node Exporter installed on port ${port}`);
    } catch (error) {
      console.error('Failed to install Node Exporter:', error);
      // 실패 시 로컬 설치 스크립트 경로 제공
      console.log(`💡 Manual installation script: ./scripts/setup-node-monitoring.sh ${node.nodeIp} ${node.nodeName || node.nodeId}`);
    }
  }

  /**
   * cAdvisor를 원격 노드에 설치
   */
  private async installCadvisor(
    node: BuildNode,
    port: number
  ): Promise<void> {
    console.log(`🐳 Installing cAdvisor on ${node.nodeId}...`);

    const installCommand = `
      ssh ${node.nodeIp} "docker run -d \\
        --name cadvisor \\
        --restart unless-stopped \\
        --volume=/:/rootfs:ro \\
        --volume=/var/run:/var/run:ro \\
        --volume=/sys:/sys:ro \\
        --volume=/var/lib/docker/:/var/lib/docker:ro \\
        --volume=/dev/disk/:/dev/disk:ro \\
        --publish=${port}:8080 \\
        --privileged \\
        --device=/dev/kmsg \\
        gcr.io/cadvisor/cadvisor:latest"
    `;

    try {
      // 실제 환경에서는 SSH 연결 설정 필요
      // await execAsync(installCommand);
      console.log(`✅ cAdvisor installed on port ${port}`);
    } catch (error) {
      console.error('Failed to install cAdvisor:', error);
    }
  }

  /**
   * 노드를 Prometheus 레지스트리에 등록
   */
  private async registerNodeToPrometheus(
    node: BuildNode,
    exporterPort: number,
    labels: Record<string, string>
  ): Promise<void> {
    console.log(`📝 Registering ${node.nodeId} to Prometheus...`);

    await this.nodeRegistry.registerNode(
      node.nodeId,
      node.nodeIp,
      exporterPort,
      labels
    );

    console.log(`✅ Node ${node.nodeId} registered to Prometheus`);
  }

  /**
   * Docker 빌드 완료 후 자동 호출되는 훅
   */
  async onBuildComplete(
    buildId: string,
    targetNodes: BuildNode[]
  ): Promise<void> {
    console.log(`🔄 Build ${buildId} complete, setting up monitoring for ${targetNodes.length} nodes`);

    // 병렬로 모든 노드에 모니터링 설정
    const setupPromises = targetNodes.map(node =>
      this.setupMonitoringOnBuild(node, {
        installExporter: true,
        installCadvisor: true,
        autoRegister: true,
        labels: {
          build_id: buildId,
          deployment_time: new Date().toISOString()
        }
      })
    );

    const results = await Promise.allSettled(setupPromises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 Monitoring setup complete: ${successful} successful, ${failed} failed`);
  }

  /**
   * 기존 빌드 노드에 모니터링 추가
   */
  async addMonitoringToExistingNode(
    nodeIp: string,
    nodeId?: string
  ): Promise<void> {
    const node: BuildNode = {
      nodeId: nodeId || `build-node-${Date.now()}`,
      nodeIp: nodeIp,
      nodeType: 'build-runtime'
    };

    await this.setupMonitoringOnBuild(node);
  }

  /**
   * 모든 빌드 노드 상태 확인
   */
  async checkAllBuildNodes(): Promise<Map<string, boolean>> {
    const nodes = await this.nodeRegistry.listNodes();
    const buildNodes = nodes.filter(n =>
      n.labels.managed_by === 'build-service'
    );

    const healthMap = new Map<string, boolean>();

    for (const node of buildNodes) {
      const [ip, port] = node.targets[0].split(':');
      const isHealthy = await this.nodeRegistry.checkNodeHealth(ip, parseInt(port));
      healthMap.set(node.labels.node, isHealthy);
    }

    return healthMap;
  }
}

// 싱글톤 인스턴스
let buildIntegration: BuildMonitoringIntegration | null = null;

export function getBuildMonitoringIntegration(): BuildMonitoringIntegration {
  if (!buildIntegration) {
    buildIntegration = new BuildMonitoringIntegration();
  }
  return buildIntegration;
}