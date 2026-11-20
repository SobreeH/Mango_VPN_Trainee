FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY Sobree/vpn-daemon/go.mod ./
RUN go mod download

COPY Sobree/vpn-daemon/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/vpn-daemon .

FROM alpine:3.20
RUN apk add --no-cache wireguard-tools nftables iproute2 ca-certificates wget

WORKDIR /app
COPY --from=builder /out/vpn-daemon /usr/local/bin/vpn-daemon

EXPOSE 50051/tcp 51820/udp

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:50051/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/vpn-daemon"]
