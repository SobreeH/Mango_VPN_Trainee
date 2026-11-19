export interface InternalService {
  name: string;
  url: string;
  port: number;
}

export interface GatewayTarget {
  id: string;
  nameKey: 'hqTitle' | 'cloudTitle' | 'devTitle' | 'egressTitle';
  descKey: 'hqDesc' | 'cloudDesc' | 'devDesc' | 'egressDesc';
  subnet: string;
  endpoint: string;
  icon: 'building' | 'cloud' | 'flask' | 'globe';
  defaultIp: string;
  internalServices: InternalService[];
}

export const ADMIN_GATEWAYS: GatewayTarget[] = [
  {
    id: 'gw-hq',
    nameKey: 'hqTitle',
    descKey: 'hqDesc',
    subnet: '10.0.0.0/8',
    endpoint: 'vpn-hq.mangovpn.internal:51820',
    icon: 'building',
    defaultIp: '10.0.0.15/32',
    internalServices: [
      { name: 'Core LDAP / Directory', url: 'ldap://10.0.1.10:389', port: 389 },
      { name: 'Corporate Storage NAS', url: 'smb://10.0.2.50', port: 445 },
    ],
  },
  {
    id: 'gw-cloud',
    nameKey: 'cloudTitle',
    descKey: 'cloudDesc',
    subnet: '172.16.0.0/12',
    endpoint: 'vpn-cloud.mangovpn.internal:51820',
    icon: 'cloud',
    defaultIp: '172.16.10.45/32',
    internalServices: [
      { name: 'Postgres Prod Cluster', url: 'postgresql://172.16.20.5:5432', port: 5432 },
      { name: 'Redis Cache Cluster', url: 'redis://172.16.20.8:6379', port: 6379 },
    ],
  },
  {
    id: 'gw-dev',
    nameKey: 'devTitle',
    descKey: 'devDesc',
    subnet: '192.168.0.0/16',
    endpoint: 'vpn-dev.mangovpn.internal:51820',
    icon: 'flask',
    defaultIp: '192.168.1.88/32',
    internalServices: [
      { name: 'K8s DevOps Cluster', url: 'https://192.168.10.1:6443', port: 6443 },
      { name: 'CI/CD Pipeline Runner', url: 'http://192.168.20.10:8080', port: 8080 },
    ],
  },
  {
    id: 'gw-egress',
    nameKey: 'egressTitle',
    descKey: 'egressDesc',
    subnet: '0.0.0.0/0',
    endpoint: 'vpn.mangovpn.internal:51820',
    icon: 'globe',
    defaultIp: '10.13.13.2/32',
    internalServices: [
      { name: 'Zero-Trust Egress Firewall', url: 'https://10.13.13.1:8443', port: 8443 },
      { name: 'DNS Shield & Security Filter', url: 'dns://10.13.13.1:53', port: 53 },
    ],
  },
];
