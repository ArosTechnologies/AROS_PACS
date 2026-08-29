FROM orthancteam/orthanc:latest

USER root
# Install gettext-base for envsubst and curl for healthchecks
RUN apt-get update && apt-get install -y gettext-base curl && rm -rf /var/lib/apt/lists/*

COPY orthanc.json.template /etc/orthanc/orthanc.json.template
COPY webhook.py /etc/orthanc/webhook.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Healthcheck to verify Orthanc HTTP server is up and responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8042/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
