FROM python:3.12-alpine
RUN apk add --no-cache iproute2 curl
COPY deploy/gns3/images/appliance-sim/server.py /usr/local/bin/sim-server.py
ENTRYPOINT ["python3", "/usr/local/bin/sim-server.py"]
