FROM coredns/coredns:latest AS src

FROM alpine:3.20
RUN apk add --no-cache bind-tools
COPY --from=src /coredns /usr/local/bin/coredns
COPY deploy/gns3/images/coredns/Corefile.c1 /etc/coredns/Corefile.c1
COPY deploy/gns3/images/coredns/Corefile.c2 /etc/coredns/Corefile.c2
COPY deploy/gns3/images/coredns/db.mango.lab.c1 /etc/coredns/db.mango.lab.c1
COPY deploy/gns3/images/coredns/db.mango.lab.c2 /etc/coredns/db.mango.lab.c2
COPY deploy/gns3/images/coredns/db.aws.lab.c2 /etc/coredns/db.aws.lab.c2
RUN chmod 644 /etc/coredns/*
ENTRYPOINT ["/usr/local/bin/coredns"]
CMD ["-conf", "/etc/coredns/Corefile.c1"]
