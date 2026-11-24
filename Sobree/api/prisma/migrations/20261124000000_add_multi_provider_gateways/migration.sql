-- CreateEnum
CREATE TYPE "VpnProviderType" AS ENUM ('WIREGUARD', 'FORTINET', 'CISCO');

-- CreateEnum
CREATE TYPE "GatewayIpamMode" AS ENUM ('API_MANAGED', 'GATEWAY_ASSIGNED');

-- DropIndex
DROP INDEX "vpn_peers_assigned_ip_key";

-- AlterTable
ALTER TABLE "connect_tickets" ADD COLUMN     "gateway_id" UUID;

-- AlterTable
ALTER TABLE "vpn_peers" ADD COLUMN     "gateway_id" UUID,
ADD COLUMN     "peer_identity" TEXT,
ADD COLUMN     "provider_type" "VpnProviderType" NOT NULL DEFAULT 'WIREGUARD';

-- AlterTable
ALTER TABLE "vpn_sessions" ADD COLUMN     "gateway_id" UUID,
ADD COLUMN     "provider_session_ref" TEXT,
ADD COLUMN     "provider_type" "VpnProviderType" NOT NULL DEFAULT 'WIREGUARD';

-- CreateTable
CREATE TABLE "vpn_gateways" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" "VpnProviderType" NOT NULL DEFAULT 'WIREGUARD',
    "endpoint" TEXT NOT NULL,
    "subnet_cidr" TEXT NOT NULL DEFAULT '10.13.13.0/24',
    "ipam_mode" "GatewayIpamMode" NOT NULL DEFAULT 'API_MANAGED',
    "dns" TEXT[] DEFAULT ARRAY['1.1.1.1']::TEXT[],
    "allowed_roles" "RoleName"[] DEFAULT ARRAY['ADMIN', 'STAFF', 'CLIENT']::"RoleName"[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_gateways_name_key" ON "vpn_gateways"("name");

-- CreateIndex
CREATE INDEX "connect_tickets_gateway_id_idx" ON "connect_tickets"("gateway_id");

-- CreateIndex
CREATE INDEX "vpn_peers_gateway_id_idx" ON "vpn_peers"("gateway_id");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_peers_gateway_id_assigned_ip_key" ON "vpn_peers"("gateway_id", "assigned_ip");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_peers_gateway_id_peer_identity_key" ON "vpn_peers"("gateway_id", "peer_identity");

-- CreateIndex
CREATE INDEX "vpn_sessions_gateway_id_idx" ON "vpn_sessions"("gateway_id");

-- AddForeignKey
ALTER TABLE "vpn_peers" ADD CONSTRAINT "vpn_peers_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "vpn_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_sessions" ADD CONSTRAINT "vpn_sessions_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "vpn_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_tickets" ADD CONSTRAINT "connect_tickets_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "vpn_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

