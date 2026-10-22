/**
 * Infrastructure fleet and topology sample data.
 * All demo metrics labeled as Demo data.
 */

export interface NodeItem {
  id: string;
  name: string;
  ip: string;
  zone: string;
  pool: string;
  instanceType: string;
  cores: number;
  memoryGiB: number;
  cpuUsage: number;
  memoryUsage: number;
  podsCount: number;
  status: 'Ready' | 'SchedulingDisabled' | 'Warning';
  uptime: string;
  kernel: string;
}

export type InfrastructureNode = NodeItem;

export const infrastructureSummaryMetrics = [
  {
    id: 'nodes-total',
    label: 'Total Cluster Nodes',
    value: '9 Active',
    detail: '3 Node Pools across 3 AZs',
    icon: 'dns',
  },
  {
    id: 'vcpu-alloc',
    label: 'Total vCPU Capacity',
    value: '192 Cores',
    detail: '48.2% avg utilization',
    icon: 'memory',
  },
  {
    id: 'memory-alloc',
    label: 'Total Cluster RAM',
    value: '768 GiB',
    detail: '56.4% avg allocation',
    icon: 'developer_board',
  },
  {
    id: 'storage-pvc',
    label: 'Persistent Volumes',
    value: '1.95 TB',
    detail: 'EBS gp3 CSI driver attached',
    icon: 'hard_drive',
  },
];

export const multiAzBreakdown = [
  {
    zone: 'us-east-1a',
    status: 'Healthy',
    nodesCount: 3,
    podsCount: 41,
    cpuUsage: 38,
    memoryUsage: 46,
  },
  {
    zone: 'us-east-1b',
    status: 'Healthy',
    nodesCount: 3,
    podsCount: 52,
    cpuUsage: 54,
    memoryUsage: 64,
  },
  {
    zone: 'us-east-1c',
    status: 'Healthy',
    nodesCount: 3,
    podsCount: 42,
    cpuUsage: 45,
    memoryUsage: 62,
  },
];

export const nodePools: NodeItem[] = [
  {
    id: 'node-01',
    name: 'ip-10-0-12-44.ec2.internal',
    ip: '10.0.12.44',
    zone: 'us-east-1a',
    pool: 'compute-optimized',
    instanceType: 'c6i.4xlarge',
    cores: 16,
    memoryGiB: 32,
    cpuUsage: 38,
    memoryUsage: 48,
    podsCount: 14,
    status: 'Ready',
    uptime: '18d 4h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-02',
    name: 'ip-10-0-12-92.ec2.internal',
    ip: '10.0.12.92',
    zone: 'us-east-1a',
    pool: 'compute-optimized',
    instanceType: 'c6i.4xlarge',
    cores: 16,
    memoryGiB: 32,
    cpuUsage: 44,
    memoryUsage: 52,
    podsCount: 16,
    status: 'Ready',
    uptime: '18d 4h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-03',
    name: 'ip-10-0-12-108.ec2.internal',
    ip: '10.0.12.108',
    zone: 'us-east-1a',
    pool: 'memory-optimized',
    instanceType: 'r6i.4xlarge',
    cores: 16,
    memoryGiB: 128,
    cpuUsage: 32,
    memoryUsage: 39,
    podsCount: 11,
    status: 'Ready',
    uptime: '12d 8h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-04',
    name: 'ip-10-0-24-11.ec2.internal',
    ip: '10.0.24.11',
    zone: 'us-east-1b',
    pool: 'compute-optimized',
    instanceType: 'c6i.4xlarge',
    cores: 16,
    memoryGiB: 32,
    cpuUsage: 51,
    memoryUsage: 65,
    podsCount: 18,
    status: 'Ready',
    uptime: '24d 1h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-05',
    name: 'ip-10-0-24-19.ec2.internal',
    ip: '10.0.24.19',
    zone: 'us-east-1b',
    pool: 'memory-optimized',
    instanceType: 'r6i.4xlarge',
    cores: 16,
    memoryGiB: 128,
    cpuUsage: 63,
    memoryUsage: 71,
    podsCount: 19,
    status: 'Ready',
    uptime: '24d 1h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-06',
    name: 'ip-10-0-24-88.ec2.internal',
    ip: '10.0.24.88',
    zone: 'us-east-1b',
    pool: 'storage-optimized',
    instanceType: 'i3en.3xlarge',
    cores: 12,
    memoryGiB: 96,
    cpuUsage: 48,
    memoryUsage: 58,
    podsCount: 15,
    status: 'Ready',
    uptime: '9d 12h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-07',
    name: 'ip-10-0-36-05.ec2.internal',
    ip: '10.0.36.05',
    zone: 'us-east-1c',
    pool: 'compute-optimized',
    instanceType: 'c6i.4xlarge',
    cores: 16,
    memoryGiB: 32,
    cpuUsage: 59,
    memoryUsage: 62,
    podsCount: 13,
    status: 'Ready',
    uptime: '15d 6h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-08',
    name: 'ip-10-0-36-22.ec2.internal',
    ip: '10.0.36.22',
    zone: 'us-east-1c',
    pool: 'memory-optimized',
    instanceType: 'r6i.4xlarge',
    cores: 16,
    memoryGiB: 128,
    cpuUsage: 41,
    memoryUsage: 82,
    podsCount: 17,
    status: 'Ready',
    uptime: '15d 6h',
    kernel: 'Linux 5.15.0-89-aws',
  },
  {
    id: 'node-09',
    name: 'ip-10-0-36-74.ec2.internal',
    ip: '10.0.36.74',
    zone: 'us-east-1c',
    pool: 'storage-optimized',
    instanceType: 'i3en.3xlarge',
    cores: 12,
    memoryGiB: 96,
    cpuUsage: 37,
    memoryUsage: 44,
    podsCount: 12,
    status: 'Ready',
    uptime: '30d 2h',
    kernel: 'Linux 5.15.0-89-aws',
  },
];

export const INFRA_NODES = nodePools;

export interface StorageClaim {
  name: string;
  namespace: string;
  storageClass: string;
  size: string;
  usedPercentage: number;
  accessMode: string;
  status: string;
}

export const storageClaims: StorageClaim[] = [
  {
    name: 'pvc-db-cluster-wal-01',
    namespace: 'database',
    storageClass: 'ebs-gp3-sc',
    size: '1.6 TiB',
    usedPercentage: 68,
    accessMode: 'ReadWriteOnce',
    status: 'Bound',
  },
  {
    name: 'pvc-redis-persistence-replica',
    namespace: 'cache',
    storageClass: 'ebs-gp3-sc',
    size: '600 GiB',
    usedPercentage: 52,
    accessMode: 'ReadWriteOnce',
    status: 'Bound',
  },
  {
    name: 'pvc-kafka-eventlogs-buffer',
    namespace: 'event-stream',
    storageClass: 'ebs-io2-extreme',
    size: '2.0 TiB',
    usedPercentage: 74,
    accessMode: 'ReadWriteMany',
    status: 'Bound',
  },
  {
    name: 'pvc-elastic-indices-hot',
    namespace: 'logging',
    storageClass: 'ebs-gp3-sc',
    size: '3.2 TiB',
    usedPercentage: 81,
    accessMode: 'ReadWriteOnce',
    status: 'Bound',
  },
];

export const STORAGE_PVCS = storageClaims;

export const terraformBlueprintSnippet = `# Production Kubernetes Cluster Configuration
# Managed by Terraform v1.8.2 (Demo data)

module "eks_cluster" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "cloudops-primary-prod"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    compute_pool = {
      min_size     = 3
      max_size     = 12
      desired_size = 4
      instance_types = ["c6i.4xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        tier = "compute-optimized"
      }
    }

    memory_pool = {
      min_size     = 2
      max_size     = 8
      desired_size = 3
      instance_types = ["r6i.4xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        tier = "memory-optimized"
      }
    }
  }

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}
`;
