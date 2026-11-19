-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(30) NOT NULL,
    "role_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(150) NOT NULL,
    "os_info" VARCHAR(150) NOT NULL,
    "mac_address" VARCHAR(50),
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_peers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "public_key" VARCHAR(64) NOT NULL,
    "assigned_ip" VARCHAR(45) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_peers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_sessions" (
    "id" UUID NOT NULL,
    "peer_id" UUID NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),
    "client_public_ip" VARCHAR(45) NOT NULL,
    "bytes_rx" BIGINT NOT NULL DEFAULT 0,
    "bytes_tx" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "vpn_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_policies" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "destination_cidr" VARCHAR(50) NOT NULL,
    "protocol" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "port_range" VARCHAR(50) NOT NULL DEFAULT 'ANY',
    "action" VARCHAR(10) NOT NULL DEFAULT 'ALLOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "metadata_json" JSONB,
    "ip_address" VARCHAR(45) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" UUID NOT NULL,
    "version_string" VARCHAR(30) NOT NULL,
    "download_url" VARCHAR(500) NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "devices_mac_address_idx" ON "devices"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_peers_public_key_key" ON "vpn_peers"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_peers_assigned_ip_key" ON "vpn_peers"("assigned_ip");

-- CreateIndex
CREATE INDEX "vpn_peers_user_id_idx" ON "vpn_peers"("user_id");

-- CreateIndex
CREATE INDEX "vpn_peers_assigned_ip_idx" ON "vpn_peers"("assigned_ip");

-- CreateIndex
CREATE INDEX "vpn_sessions_peer_id_idx" ON "vpn_sessions"("peer_id");

-- CreateIndex
CREATE INDEX "vpn_sessions_connected_at_idx" ON "vpn_sessions"("connected_at");

-- CreateIndex
CREATE INDEX "vpn_policies_role_id_idx" ON "vpn_policies"("role_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_version_string_key" ON "agent_versions"("version_string");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_peers" ADD CONSTRAINT "vpn_peers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_peers" ADD CONSTRAINT "vpn_peers_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_sessions" ADD CONSTRAINT "vpn_sessions_peer_id_fkey" FOREIGN KEY ("peer_id") REFERENCES "vpn_peers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_policies" ADD CONSTRAINT "vpn_policies_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
