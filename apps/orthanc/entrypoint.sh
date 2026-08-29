#!/bin/bash
set -e

mkdir -p /var/lib/orthanc/db
chown -R orthanc:orthanc /var/lib/orthanc/db

echo "Generating orthanc.json from template..."
envsubst < /etc/orthanc/orthanc.json.template > /tmp/orthanc.json
chown orthanc:orthanc /tmp/orthanc.json

echo "Starting Orthanc..."
exec su -s /bin/sh orthanc -c "Orthanc /tmp/orthanc.json"
