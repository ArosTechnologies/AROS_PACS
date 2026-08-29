# Fase 4: Configuración de Orthanc PACS y StorageCache

## Objetivo de la Fase
Desplegar la instancia dockerizada de Orthanc PACS para la clínica. Orthanc debe correr nativamente en ARM64, almacenar las imágenes pesadas directamente en Amazon S3 y enviar notificaciones vía Webhook a la Clinic API cuando un estudio ha terminado de recibirse desde la máquina de Rayos X/RM.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas de Ingesta DICOM (C-STORE)
- **Prueba:** Usar la utilidad `storescu` del toolkit dcmtk o el script de Python `pynetdicom` para enviar 500 imágenes DICOM al puerto 4242 del contenedor Orthanc.
- **Éxito:** Orthanc recibe todas las imágenes sin errores de memoria RAM. Los logs de AWS CloudWatch muestran la transferencia eficiente.

### 2. Pruebas de Delegación a S3 (AwsS3Storage)
- **Prueba:** Verificar el tamaño del almacenamiento local en el contenedor de Orthanc después de la ingesta masiva de imágenes DICOM.
- **Éxito:** El disco duro local (EBS/EFS) está prácticamente vacío. Las imágenes han sido delegadas exitosamente al Bucket de S3 de la clínica usando el plugin oficial de AWS S3 de Orthanc.

### 3. Pruebas del Evento OnStableStudy
- **Prueba:** Orthanc detecta que han pasado N segundos sin recibir nuevas instancias de un estudio (Stable Age).
- **Éxito:** Orthanc dispara una petición HTTP POST (Webhook) a la IP interna de la Clinic API, firmando la petición con una cabecera de secreto HMAC-SHA256 pre-compartida.

### 4. Pruebas de Optimización de Memoria (StorageCache)
- **Prueba:** Lanzar Orthanc con límite de memoria Docker de 1GB e ingestar un archivo DICOM de tomografía que pesa 1.5GB.
- **Éxito:** Orthanc no crashea con error *OOM (Out Of Memory)*, demostrando que el plugin `MaximumStorageCacheSize` configurado a 512MB está liberando la memoria a medida que hace *streaming* de la data hacia S3.
