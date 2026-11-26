# Mango VPN AWS-managed deployment

This template creates a VPC, private RDS PostgreSQL 16, Secrets Manager secrets, ECR repositories (`api`, `portal`, and `vpn-daemon`), private ECS Fargate API and portal services, an internet-facing ALB, and a dedicated EC2 WireGuard gateway. The API and portal services default to zero tasks so the stack creates cleanly before ECR images are pushed.

## 1. Prerequisites

- AWS CLI v2 configured in the target account and region (and Session Manager plugin installed locally for `aws ssm start-session`).
- Docker (with `docker buildx` if building cross-architecture images), Node/npm, and the repository checkout.
- A real public or office IPv4 CIDR (`<YOUR_PUBLIC_IP>/32`). Do not use `203.0.113.0/24` in a live deployment.
- An ACM certificate ARN + matching `CustomDomainName` (e.g. `vpn.example.com`) for HTTPS. Leave both blank only for temporary HTTP-only dev testing (see `docs/tutorial/03-track-c-cloud-deployment.md` for zero-domain CloudFront/SSM options because Chromium Private Network Access blocks `127.0.0.1:47821` from plain remote `http://` origins).

Copy `parameters.example.json` to `parameters.json` (gitignored or local only) and replace `<YOUR_PUBLIC_IP>/32`.

## 2. Validate and create the stack

```bash
aws cloudformation validate-template \
  --template-body file://deploy/aws-managed/template.yaml

aws cloudformation create-stack \
  --stack-name mango-vpn-managed \
  --template-body file://deploy/aws-managed/template.yaml \
  --parameters file://deploy/aws-managed/parameters.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

aws cloudformation wait stack-create-complete --stack-name mango-vpn-managed
```

> Note: `aws cloudformation create-stack` accepts the JSON array format in `parameters.example.json`, whereas `aws cloudformation deploy` takes `Key=Value` overrides.

## 3. Build and push images to ECR

Get the three ECR repository URIs from stack outputs, then push `api`, `portal` (`linux/amd64` for Fargate), and `vpn-daemon` (`linux/arm64` for `t4g.micro`, or `linux/amd64` if using `t3.micro`):

```bash
REGION=$(aws configure get region)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
API_REPO=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`ApiEcrRepository`].OutputValue' --output text)
PORTAL_REPO=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`PortalEcrRepository`].OutputValue' --output text)
DAEMON_REPO=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`DaemonEcrRepository`].OutputValue' --output text)

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

docker buildx build --platform linux/amd64 -f Sobree/api/Dockerfile -t "$API_REPO:latest" --push .
docker buildx build --platform linux/amd64 -f Rain/portal/Dockerfile -t "$PORTAL_REPO:latest" --push .
docker buildx build --platform linux/arm64 -f Sobree/vpn-daemon/Dockerfile -t "$DAEMON_REPO:latest" --push .
```

## 4. Populate runtime secrets & start the WireGuard Gateway

The stack generates RDS, JWT, refresh, and daemon secrets automatically. Populate the 64-hex-character `TOTP_ENCRYPTION_KEY`:

```bash
TOTP_ARN=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`TotpEncryptionSecretArn`].OutputValue' --output text)
TOTP_KEY=$(openssl rand -hex 32)
aws secretsmanager put-secret-value --secret-id "$TOTP_ARN" --secret-string "$TOTP_KEY"
unset TOTP_KEY
```

Connect to the gateway EC2 instance over **AWS Systems Manager Session Manager** (no SSH port 22 needed), generate the WireGuard keypair, save it into Secrets Manager, and start `mango-vpn-daemon`:

```bash
GW_ID=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`WireGuardGatewayInstanceId`].OutputValue' --output text)
WG_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name mango-vpn-managed --query 'Stacks[0].Outputs[?OutputKey==`WireGuardKeySecretArn`].OutputValue' --output text)
echo "GW_ID=$GW_ID WG_SECRET_ARN=$WG_SECRET_ARN"

aws ssm start-session --target "$GW_ID"
```

Inside the SSM session on the gateway EC2 instance:

```bash
PRIVATE_KEY=$(wg genkey)
PUBLIC_KEY=$(printf '%s' "$PRIVATE_KEY" | wg pubkey)
aws secretsmanager put-secret-value --region "<AWS_REGION>" --secret-id "<WG_SECRET_ARN>" \
  --secret-string "$(jq -cn --arg privateKey "$PRIVATE_KEY" --arg publicKey "$PUBLIC_KEY" '{privateKey:$privateKey,publicKey:$publicKey}')"
unset PRIVATE_KEY
sudo /usr/local/bin/mango-gateway-start.sh
docker ps && sudo wg show
```

## 5. Start ECS services & seed the first ADMIN

Scale both ECS services to `1`:

```bash
aws cloudformation update-stack \
  --stack-name mango-vpn-managed \
  --use-previous-template \
  --parameters \
    ParameterKey=AllowedWebCidr,UsePreviousValue=true \
    ParameterKey=AllowedWireGuardCidr,UsePreviousValue=true \
    ParameterKey=CertificateArn,UsePreviousValue=true \
    ParameterKey=CustomDomainName,UsePreviousValue=true \
    ParameterKey=EnableNatGateway,UsePreviousValue=true \
    ParameterKey=ApiDesiredCount,ParameterValue=1 \
    ParameterKey=PortalDesiredCount,ParameterValue=1 \
    ParameterKey=ApiImageTag,UsePreviousValue=true \
    ParameterKey=PortalImageTag,UsePreviousValue=true \
    ParameterKey=DaemonImageTag,UsePreviousValue=true \
    ParameterKey=DBInstanceClass,UsePreviousValue=true \
    ParameterKey=GatewayInstanceType,UsePreviousValue=true \
    ParameterKey=UbuntuAmiId,UsePreviousValue=true \
    ParameterKey=WgListenPort,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

aws ecs wait services-stable --cluster mango-vpn-managed-ecs --services mango-vpn-managed-api mango-vpn-managed-portal
```

Once `ApiService` is running, seed the initial `ADMIN` user via **ECS Exec** (no public DB port needed):

```bash
TASK_ARN=$(aws ecs list-tasks --cluster mango-vpn-managed-ecs --service-name mango-vpn-managed-api --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster mango-vpn-managed-ecs --task "$TASK_ARN" --container api --interactive --command "/bin/sh"
```

Inside the ECS container shell:

```sh
export DATABASE_URL="postgresql://mango:${DB_PASSWORD}@${DB_HOST}:5432/mangovpn?schema=public"
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='<Choose-12+-Char-Password>' node Rain/admin/dist/seed.js
```

## 6. Cost and security notes

- NAT Gateway, RDS PostgreSQL, Fargate tasks, the gateway EC2 instance, EIPs, CloudWatch Logs, and ECR storage all incur ongoing AWS charges.
- RDS is encrypted, private (`PubliclyAccessible: false`), and reachable only from `EcsApiSecurityGroup`. No SSH ingress is created; gateway administration uses SSM.
- Stateful RDS, ECR repositories, and CloudWatch log groups use `DeletionPolicy: Retain` / `Snapshot` and survive stack deletion.

## 7. Teardown

```bash
aws cloudformation delete-stack --stack-name mango-vpn-managed
aws cloudformation wait stack-delete-complete --stack-name mango-vpn-managed
# Optionally clean retained ECR repos, log groups, and RDS snapshots once verified:
aws ecr delete-repository --repository-name "$API_REPO_NAME" --force
aws ecr delete-repository --repository-name "$PORTAL_REPO_NAME" --force
aws ecr delete-repository --repository-name "$DAEMON_REPO_NAME" --force
```
