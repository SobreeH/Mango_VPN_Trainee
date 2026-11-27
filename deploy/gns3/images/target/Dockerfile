FROM nginx:1.27-alpine
RUN apk add --no-cache iproute2 openssl curl
COPY deploy/gns3/setup-target-node.sh /usr/local/bin/setup-target-node.sh
RUN chmod +x /usr/local/bin/setup-target-node.sh
ENTRYPOINT ["/usr/local/bin/setup-target-node.sh"]
