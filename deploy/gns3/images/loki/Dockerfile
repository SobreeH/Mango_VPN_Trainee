FROM grafana/loki:latest AS src

FROM alpine:3.20
RUN mkdir -p /loki/chunks /loki/rules
COPY --from=src /usr/bin/loki /usr/local/bin/loki
COPY --from=src /etc/loki/local-config.yaml /etc/loki/local-config.yaml
ENTRYPOINT ["/usr/local/bin/loki"]
CMD ["-config.file=/etc/loki/local-config.yaml"]
