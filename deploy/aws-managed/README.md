# MANGO VPN - AWS Managed Deployment

This CloudFormation template deploys the MANGO VPN Zero-Trust Remote Access System on AWS with:
- VPC with public/private subnets across 2 AZs
- RDS PostgreSQL 16 (private subnet)
- ECS Fargate for API and Portal
- Application Load Balancer (HTTP/HTTPS)
- EC2 WireGuard Gateway in public subnet

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Docker installed for building and pushing images
3. (Optional) ACM certificate for HTTPS

## Quick Start

### 1. Create Parameter File

Copy the example parameters and customize:

```bash
cp deploy/aws-managed/parameters.example.json deploy/aws-managed/parameters.json
```

Edit `parameters.json` with your values:
- `AllowedWebCidr`: Your public IP CIDR (e.g., `203.0.113.5/32` for single IP)
- `AllowedWireGuardCidr`: CIDR for WireGuard client connections
- `CertificateArn`: ACM certificate ARN for HTTPS, or empty string for HTTP-only dev

### 2. Validate Template

```bash
aws cloudformation validate-template \
  --template-body file://deploy/aws-managed/template.yaml
```

### 3. Deploy Stack

```bash
aws cloudformation deploy \
  --stack-name mango-vpn-prod \
  --template-file deploy/aws-managed/template.yaml \
  --parameter-overrides file://deploy/aws-managed/parameters.json \
  --capabilities CAPABILITY_IAM
```

**Important**: Default `ApiDesiredCount=0` and `PortalDesiredCount=0` allows clean first deploy before ECR images exist.

### 4. Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name mango-vpn-prod \
  --query 'Stacks[0].Outputs'
```

Save these output values for the next steps.

### 5. Populate Secrets

#### Database URL

Get the RDS endpoint and DB password, then populate the DATABASE_URL secret:

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name mango-vpn-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`RdsEndpoint`].OutputValue' \
  --output text)

# Get DB password (temporary - only works immediately after stack creation)
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id mango-vpn-prod-DbMasterSecret-XXXXX \
  --query SecretString \
  --output text | jq -r '.password')

# Update DATABASE_URL secret
aws secretsmanager put-secret-value \
  --secret-id mango-vpn-prod-DatabaseUrlSecret-XXXXX \
  --secret-string "postgresql://mango:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/mangovpn?schema=public"
```

#### TOTP Encryption Key

Generate a 64-character hex string:

```bash
TOTP_KEY=$(openssl rand -hex 32)

aws secretsmanager put-secret-value \
  --secret-id mango-vpn-prod-TotpEncryptionSecret-XXXXX \
  --secret-string "{\"key\":\"${TOTP_KEY}\"}"
```

### 6. Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Build and push API
docker build -f Sobree/api/Dockerfile -t mango-vpn-prod-api .
docker tag mango-vpn-prod-api:latest <account-id>.dkr.ecr.<region>.amazonaws.com/mango-vpn-prod-api:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/mango-vpn-prod-api:latest

# Build and push Portal
docker build -f Rain/portal/Dockerfile -t mango-vpn-prod-portal .
docker tag mango-vpn-prod-portal:latest <account-id>.dkr.ecr.<region>.amazonaws.com/mango-vpn-prod-portal:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/mango-vpn-prod-portal:latest
```

### 7. Setup WireGuard Gateway

Connect via SSM Session Manager:

```bash
aws ssm start-session --target <instance-id>
```

On the gateway instance:

```bash
# Generate WireGuard keypair
wg genkey | tee /etc/wireguard/privatekey | wg pubkey > /etc/wireguard/publickey

# Get private key for storage
WG_PRIVATE=$(cat /etc/wireguard/privatekey)

# Store private key in Secrets Manager (run from your local machine after)
```

Update the WireGuardKeySecret:

```bash
WG_PRIVATE=$(ssh-to-instance cat /etc/wireguard/privatekey)

aws secretsmanager put-secret-value \
  --secret-id mango-vpn-prod-WireGuardKeySecret-XXXXX \
  --secret-string "{\"privateKey\":\"${WG_PRIVATE}\"}"
```

Configure WireGuard interface `/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = 10.13.13.1/24
ListenPort = 51820
PrivateKey = <private-key-from-file>

[Peer]
# Allow all clients; API will add specific peers
AllowedIPs = 10.13.13.0/24
```

Start WireGuard:

```bash
wg-quick up wg0
systemctl enable wg-quick@wg0
```

### 8. Scale ECS Services

After secrets and images are ready:

```bash
# Scale API to 1 task
aws ecs update-service \
  --cluster mango-vpn-prod-cluster \
  --service mango-vpn-prod-api \
  --desired-count 1

# Scale Portal to 1 task
aws ecs update-service \
  --cluster mango-vpn-prod-cluster \
  --service mango-vpn-prod-portal \
  --desired-count 1
```

Or update stack with new parameters:

```bash
aws cloudformation deploy \
  --stack-name mango-vpn-prod \
  --template-file deploy/aws-managed/template.yaml \
  --parameter-overrides \
    ApiDesiredCount=1 \
    PortalDesiredCount=1 \
    AllowedWebCidr="203.0.113.5/32" \
    AllowedWireGuardCidr="203.0.113.0/24"
```

## Architecture

```
                    +---------------------------+
                    |      Internet Users      |
                    +-------------+-------------+
                                  |
                          +-------+-------+
                          |    ALB/HTTPS  |
                          +-------+-------+
                                  |
              +-------------------+-------------------+
              |                                       |
      +-------v-------+                       +-------v-------+
      |  Portal (3000)|                       |  API (4000)   |
      +-------+-------+                       +-------+-------+
              |                                       |
              |    +----------------------------------+
              |    |
      +-------v----v-------+
      |     ECS Fargate     |
      +----------+----------+
                 |
          +------v------+
          |    RDS      |
          | PostgreSQL  |
          +-------------+

                    +---------------------------+
                    |   WireGuard Gateway       |
                    |   (EC2 Public Subnet)     |
                    +-------------+-------------+
                                  |
                          UDP 51820
                                  |
                    +-------------v-------------+
                    |   VPN Clients            |
                    +---------------------------+
```

## Cost Considerations

Estimated monthly costs (us-east-1):

| Resource | Type | Monthly Cost |
|----------|------|--------------|
| NAT Gateway | $0.045/hour + data | ~$35 + data |
| RDS | db.t4g.micro | ~$15 |
| ECS Fargate | 2 tasks @ 256 CPU | ~$25 |
| ALB | LCU hours | ~$20 |
| EIP | 2 addresses | ~$5 |
| **Total** | | **~$100/month** |

**Cost optimization**:
- Set `EnableNatGateway=false` to save ~$35/month (requires VPC endpoints for ECR/Secrets Manager)
- Use `db.t4g.micro` for development
- Scale ECS tasks to 0 when not in use
- Use Spot capacity for non-production

## Cleanup and Stack Deletion

### Pre-deletion Steps

1. Delete CloudWatch Log Groups:

```bash
aws logs delete-log-group --log-group-name /ecs/mango-vpn-prod/api
aws logs delete-log-group --log-group-name /ecs/mango-vpn-prod/portal
```

2. Empty ECR repositories:

```bash
aws ecr batch-delete-image \
  --repository-name mango-vpn-prod-api \
  --image-ids "$(aws ecr list-images --repository-name mango-vpn-prod-api --query 'imageIds[*]' --output json)"

aws ecr batch-delete-image \
  --repository-name mango-vpn-prod-portal \
  --image-ids "$(aws ecr list-images --repository-name mango-vpn-prod-portal --query 'imageIds[*]' --output json)"
```

### Delete Stack

```bash
aws cloudformation delete-stack --stack-name mango-vpn-prod
```

**Note**: RDS snapshot will be retained due to `DeletionPolicy: Snapshot`. Delete manually if desired:

```bash
aws rds describe-db-snapshots --query 'DBSnapshots[?contains(DBSnapshotIdentifier, `mango-vpn`)].DBSnapshotIdentifier'
aws rds delete-db-snapshot --db-snapshot-identifier <snapshot-id>
```

## Troubleshooting

### ECS Tasks Failing to Start

Check task logs:

```bash
aws logs tail /ecs/mango-vpn-prod/api --since 1h
```

Common issues:
- Missing secrets: Ensure all secrets are populated
- ECR image not found: Push images to ECR
- Database unreachable: Check security group rules

### WireGuard Not Working

On gateway instance:

```bash
# Check WireGuard status
wg show

# Check IP forwarding
sysctl net.ipv4.ip_forward

# Check nftables rules
nft list ruleset
```

### ALB Health Checks Failing

Check target health:

```bash
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

## Security Notes

- All secrets stored in Secrets Manager with auto-rotation capability
- No hardcoded secrets in template or parameters
- Security groups scoped to specific CIDRs (no 0.0.0.0/0)
- RDS not publicly accessible
- IMDSv2 required on EC2 instances
- EBS volumes encrypted
- RDS storage encrypted
