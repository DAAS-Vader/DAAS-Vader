import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface NodeTarget {
  targets: string[];
  labels: {
    node: string;
    type: string;
    region?: string;
    [key: string]: string | undefined;
  };
}

interface PrometheusConfig {
  global: any;
  scrape_configs: any[];
}

/**
 * Docker 빌드 노드 레지스트리 서비스
 * Prometheus 설정에 노드를 동적으로 추가/제거
 */
export class NodeRegistryService {
  private configPath: string;
  private targetsPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'prometheus.yml');
    this.targetsPath = path.join(process.cwd(), 'targets');
  }

  /**
   * 파일 기반 서비스 디스커버리를 위한 타겟 파일 생성
   */
  async initializeTargetsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.targetsPath, { recursive: true });

      // 초기 타겟 파일 생성
      const initialTargets: NodeTarget[] = [];
      await this.saveTargets('docker-nodes.json', initialTargets);

      console.log('📁 Targets directory initialized:', this.targetsPath);
    } catch (error) {
      console.error('Failed to initialize targets directory:', error);
    }
  }

  /**
   * 노드를 모니터링 대상에 추가
   */
  async registerNode(
    nodeId: string,
    nodeIp: string,
    nodePort: number = 9100,
    labels: Record<string, string> = {}
  ): Promise<void> {
    try {
      const targetFile = 'docker-nodes.json';
      const targets = await this.loadTargets(targetFile);

      // 중복 체크
      const targetAddress = `${nodeIp}:${nodePort}`;
      const existingIndex = targets.findIndex(t =>
        t.targets.includes(targetAddress)
      );

      if (existingIndex >= 0) {
        // 기존 노드 업데이트
        targets[existingIndex].labels = {
          ...targets[existingIndex].labels,
          ...labels,
          node: nodeId,
          type: 'docker-build-node',
          updated_at: new Date().toISOString()
        };
      } else {
        // 새 노드 추가
        targets.push({
          targets: [targetAddress],
          labels: {
            node: nodeId,
            type: 'docker-build-node',
            registered_at: new Date().toISOString(),
            ...labels
          }
        });
      }

      await this.saveTargets(targetFile, targets);
      console.log(`✅ Node registered: ${nodeId} (${targetAddress})`);
    } catch (error) {
      console.error('Failed to register node:', error);
      throw error;
    }
  }

  /**
   * 노드를 모니터링 대상에서 제거
   */
  async unregisterNode(nodeId: string): Promise<void> {
    try {
      const targetFile = 'docker-nodes.json';
      const targets = await this.loadTargets(targetFile);

      const filteredTargets = targets.filter(t =>
        t.labels.node !== nodeId
      );

      if (filteredTargets.length < targets.length) {
        await this.saveTargets(targetFile, filteredTargets);
        console.log(`✅ Node unregistered: ${nodeId}`);
      } else {
        console.log(`⚠️  Node not found: ${nodeId}`);
      }
    } catch (error) {
      console.error('Failed to unregister node:', error);
      throw error;
    }
  }

  /**
   * 등록된 모든 노드 조회
   */
  async listNodes(): Promise<NodeTarget[]> {
    try {
      return await this.loadTargets('docker-nodes.json');
    } catch (error) {
      console.error('Failed to list nodes:', error);
      return [];
    }
  }

  /**
   * 노드 헬스 체크
   */
  async checkNodeHealth(nodeIp: string, nodePort: number = 9100): Promise<boolean> {
    try {
      const response = await fetch(`http://${nodeIp}:${nodePort}/metrics`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error(`Node health check failed for ${nodeIp}:${nodePort}:`, error);
      return false;
    }
  }

  /**
   * 모든 노드의 헬스 상태 확인
   */
  async checkAllNodesHealth(): Promise<Map<string, boolean>> {
    const targets = await this.listNodes();
    const healthMap = new Map<string, boolean>();

    for (const target of targets) {
      for (const address of target.targets) {
        const [ip, port] = address.split(':');
        const isHealthy = await this.checkNodeHealth(ip, parseInt(port));
        healthMap.set(target.labels.node, isHealthy);
      }
    }

    return healthMap;
  }

  /**
   * Prometheus 설정 업데이트 (파일 기반 서비스 디스커버리 사용)
   */
  async updatePrometheusConfig(): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent) as PrometheusConfig;

      // 파일 기반 서비스 디스커버리 설정 확인
      const dockerNodesJob = config.scrape_configs.find(
        job => job.job_name === 'docker-nodes'
      );

      if (!dockerNodesJob) {
        // 새로운 job 추가
        config.scrape_configs.push({
          job_name: 'docker-nodes',
          file_sd_configs: [{
            files: [`${this.targetsPath}/*.json`],
            refresh_interval: '30s'
          }]
        });
      } else if (!dockerNodesJob.file_sd_configs) {
        // 기존 static_configs를 file_sd_configs로 변경
        delete dockerNodesJob.static_configs;
        dockerNodesJob.file_sd_configs = [{
          files: [`${this.targetsPath}/*.json`],
          refresh_interval: '30s'
        }];
      }

      const updatedConfig = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      await fs.writeFile(this.configPath, updatedConfig);
      console.log('✅ Prometheus config updated for file-based service discovery');
    } catch (error) {
      console.error('Failed to update Prometheus config:', error);
    }
  }

  /**
   * 타겟 파일 로드
   */
  private async loadTargets(filename: string): Promise<NodeTarget[]> {
    try {
      const filePath = path.join(this.targetsPath, filename);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * 타겟 파일 저장
   */
  private async saveTargets(filename: string, targets: NodeTarget[]): Promise<void> {
    const filePath = path.join(this.targetsPath, filename);
    await fs.writeFile(filePath, JSON.stringify(targets, null, 2));
  }
}

// 싱글톤 인스턴스
let nodeRegistry: NodeRegistryService | null = null;

export function getNodeRegistry(): NodeRegistryService {
  if (!nodeRegistry) {
    nodeRegistry = new NodeRegistryService();
  }
  return nodeRegistry;
}