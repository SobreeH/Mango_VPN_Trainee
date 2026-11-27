FROM mango-gns3-api:local
COPY deploy/gns3/images/ecs-api/entrypoint.sh /usr/local/bin/ecs-api-entrypoint.sh
RUN chmod +x /usr/local/bin/ecs-api-entrypoint.sh
CMD ["/usr/local/bin/ecs-api-entrypoint.sh"]
