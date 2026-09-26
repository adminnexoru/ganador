FROM postgres:17
RUN apt-get update && apt-get install -y --no-install-recommends awscli openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY backup.sh /usr/local/bin/backup.sh
# Un respaldo al arrancar y luego cada 24 h.
CMD ["bash", "-c", "while true; do backup.sh || echo 'respaldo falló'; sleep 86400; done"]
