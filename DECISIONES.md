# Decisiones · Laboratorio 5

## Equipo

Número de equipo: 4

| Código PUCP | Nombre | Rol | Usuario de GitHub |
|---|---|---|---|
| 20221029 | Cristian Smith Calderon Barrial | Moderador | criscal3 |
| 20201230 | Rodrigo Alonso Sanchez Pastor | Escriba | Rodrigo Armot |
| 20211729 | Lhía Hurtado Claros | Abogado del diablo | LhiaHC |
| 20220825 | Alfredo Ernesto Sanchez Tuesta | Guardián del tiempo | Alfredo123255 |
| | | Integrador | |

## A1 · Postmortem

### Resumen

El viernes 06/11 a las 17:42, el commit bd600fe llegó directamente a main, que no tiene branch protection ni exige pull request. El commit modificó infra/s3.tf para otorgar acceso de lectura al proveedor de conciliación. Al no contarse con el ID de la cuenta del proveedor, el cambio desactivó los cuatro controles de aws_s3_bucket_public_access_block.comprobantes y añadió la política aws_s3_bucket_policy.conciliacion, con Principal = "*" y la acción s3:GetObject sobre todos los objetos del bucket. El pipeline ci, que solo ejecuta pruebas unitarias, no evaluó infra/ antes del merge. El cambio se aplicó a las 17:55 mediante terraform apply desde una laptop. A partir de ese momento, todos los comprobantes del bucket quedaron accesibles públicamente. Dado que las claves son correlativas, como comprobantes/AAAA-MM-DD/NNNNNNNN.txt, función claveComprobante en src/comprobantes.js, era posible acceder a otros comprobantes modificando el número final de la URL. La exposición fue detectada externamente: el lunes 09/11 a las 08:15, un cliente publicó en redes sociales el comprobante de un tercero. A las 09:20, on-call activó el bloqueo de acceso público desde la consola de AWS. Esta medida interrumpió también el acceso del proveedor y no se reflejó en el código, de modo que infra/ continúa describiendo un bucket público.

### Impacto

El impacto se puede resumir en los siguientes hechos:

- Exposición pública de los 41 300 comprobantes del bucket, con origen, destino, monto y fecha de cada transferencia, durante 63 h 25 min. Al menos un comprobante de un tercero fue difundido en redes sociales.
- No es posible determinar cuántos comprobantes fueron descargados ni por quién, debido a que el bucket no tiene registros de acceso (CKV_AWS_18).
- Persiste un drift entre infra/ y la cuenta de AWS: el código mantiene la configuración pública, por lo que el próximo terraform apply volvería a exponer el bucket.
- El proveedor de conciliación carece de acceso desde el lunes 09/11 a las 09:25, lo que genera la penalidad contractual por cada día de retraso.
- La exposición de datos personales y financieros de terceros puede generar obligaciones regulatorias y de comunicación a los clientes afectados.

### Línea de tiempo

| Fecha y hora | Hecho |
|---|---|
| Jue 05/11 · 15:10 | El área comercial informa que el proveedor de conciliación debe leer los comprobantes desde el viernes 06/11. El contrato establece una penalidad por cada día de retraso. |
| Vie 06/11 · 09:30 | La tarea se asigna a un desarrollador backend. Ningún desarrollador del equipo había modificado infra/ anteriormente. La ingeniera de plataforma se encuentra de vacaciones del 02/11 al 13/11, sin cobertura asignada. |
| Vie 06/11 · 16:20 | El desarrollador solicita al proveedor el ID de su cuenta de AWS. No obtiene respuesta. |
| Vie 06/11 · 17:30 | El desarrollador solicita revisión por chat. El líder técnico responde desde una reunión: "dale, lo vemos el lunes". |
| Vie 06/11 · 17:42 | Se realiza un commit directo a main (bd600fe) que desactiva el bloqueo de acceso público del bucket y añade una política con Principal = "*". El pipeline ci, que solo ejecuta pruebas unitarias, no evalúa infra/. |
| Vie 06/11 · 17:55 | Se ejecuta terraform apply desde la laptop del desarrollador. El proveedor confirma que puede leer los comprobantes. **Inicio de la exposición.** |
| Sáb 07/11 y dom 08/11 | No se registran alertas. No existe monitoreo sobre la configuración del bucket. |
| Lun 09/11 · 08:15 | Un cliente publica en redes sociales el enlace de un comprobante ajeno, obtenido al modificar el número final de la URL. **Detección externa.** |
| Lun 09/11 · 08:50 | Soporte escala el caso a on-call por chat, 35 min después de la publicación. |
| Lun 09/11 · 09:20 | On-call activa el bloqueo de acceso público desde la consola de AWS. El código de infra/ no se modifica. **Fin de la exposición.** |
| Lun 09/11 · 09:25 | El proveedor de conciliación pierde el acceso a los comprobantes. |
| Lun 09/11 · 11:00 | El equipo busca los registros de acceso al bucket para dimensionar las descargas. Los registros no existen. |
| Mar 10/11 · 10:00 | Gerencia solicita un informe del incidente y un plan para evitar su repetición. |

### Causas

1. **Proceso. La revisión de cambios no era obligatoria.** La rama main no tiene branch protection, por lo que un commit puede llegar a ella sin pull request ni aprobación. La revisión dependía de una conversación por chat, y la respuesta "lo vemos el lunes" se interpretó como aprobación, según consta en el mensaje del commit: "Aprobado por chat. Se revisa el lunes".
2. **Pipeline. Ningún control analizaba infra/.** El archivo ci.yml contiene únicamente el job unit (npm test) y no revisa la infraestructura ni las dependencias. Checkov detecta seis hallazgos de exposición pública sobre los recursos del bucket (CKV_AWS_53, CKV_AWS_54, CKV_AWS_55, CKV_AWS_56, CKV_AWS_70 y CKV2_AWS_6), ninguno de los cuales fue evaluado antes del merge.
3. **Plataforma. El despliegue de infraestructura era manual.** terraform apply se ejecuta desde la laptop de quien realiza el cambio, sin un plan revisado ni un despliegue desde el pipeline. Por la misma razón, la contención se realizó desde la consola sin pasar por el código, lo que originó el drift actual.
4. **Plataforma. No existía observabilidad sobre el bucket.** El bucket carece de registros de acceso (CKV_AWS_18) y de alertas ante cambios en su configuración. En consecuencia, la exposición fue detectada por un cliente 62 h 20 min después de iniciada, y su alcance no puede medirse.
5. **Proceso y organización. El conocimiento estaba concentrado y el plazo era reducido.** Solo la ingeniera de plataforma había escrito Terraform, y se encontraba de vacaciones sin cobertura asignada. Un compromiso contractual con penalidad diaria se asignó con menos de un día hábil de plazo. Además, no había un procedimiento para escalar la falta del ID de la cuenta del proveedor (111122223333, rol conciliacion-lectura). Ante la ausencia de ese dato, el acceso se otorgó a cualquier principal.
6. **Diseño de la aplicación. Las claves de los comprobantes son predecibles.** Cada comprobante se nombra con un correlativo de 8 dígitos (`_.padStart(String(movimiento.id), 8, '0')` en claveComprobante, src/comprobantes.js), lo que permitió enumerarlos en cuanto el bucket quedó público.

### Qué funcionó y qué no funcionó

**Funcionó**

- Una vez escalado el incidente, la contención se ejecutó en 30 min desde el escalamiento y en 65 min desde la publicación en redes sociales.
- On-call contaba con acceso a la consola de AWS, lo que permitió actuar sin depender de la ingeniera de plataforma.
- Soporte identificó el problema y lo escaló a on-call por el canal definido.
- El historial de Git permitió identificar el commit (bd600fe) y el cambio exacto que originó la exposición.

**No funcionó**

- No hubo detección interna: el incidente fue detectado por un cliente.
- La revisión por chat no impidió que el cambio llegara a main.
- El pipeline no contaba con controles de seguridad sobre infra/ ni sobre las dependencias.
- La ausencia de registros de acceso impide dimensionar el impacto.
- La contención desde la consola interrumpió el acceso del proveedor y dejó el código desalineado con la cuenta de AWS.
- No fue posible otorgar un acceso de mínimo privilegio, porque faltaba el ID de la cuenta del proveedor y no existía un procedimiento para escalar esa falta.

### Acciones

| Acción | Rol responsable | Fecha límite |
|---|---|---|
| Corregiremos infra/s3.tf: restauraremos los cuatro controles de aws_s3_bucket_public_access_block.comprobantes y restringiremos la política aws_s3_bucket_policy.conciliacion al rol arn:aws:iam::111122223333:role/conciliacion-lectura, para que el código vuelva a reflejar el bloqueo hecho en la consola. El acceso del proveedor se restablecerá cuando este cambio se aplique, después del terraform plan del 16/11. | Desarrolladores backend (unidad 3) | 12/11/2026 |
| Agregaremos a ci.yml el job iac, que ejecutará Checkov sobre infra/ y bloqueará los hallazgos definidos en la Decisión 1, entre ellos los de exposición pública del bucket. | Desarrolladores backend (unidad 1) | 12/11/2026 |
| Agregaremos a ci.yml el job sca, que ejecutará Trivy sobre package-lock.json y aplicará lo definido en las Decisiones 1 y 2. | Desarrolladores backend (unidad 2) | 12/11/2026 |
| Activaremos branch protection en main: pull request obligatorio, una aprobación y los checks unit, iac y sca en verde. | Líder técnico | 13/11/2026 |
| Verificaremos con un terraform plan limpio que la cuenta de AWS coincide con infra/ antes de cualquier nuevo apply. | Ingeniera de plataforma | 16/11/2026 |
| Prepararemos con el área legal la comunicación a los clientes afectados y la evaluación de las obligaciones regulatorias. | Líder técnico | 17/11/2026 |
| Habilitaremos los registros de acceso del bucket de comprobantes y una alerta ante cambios en su política o en su public access block. | Ingeniera de plataforma | 20/11/2026 |
| Reemplazaremos el nombre correlativo de los comprobantes por un identificador no predecible. | Desarrolladores backend | 27/11/2026 |
| Definiremos un procedimiento de escalamiento para cuando un plazo contractual entre en conflicto con un control de seguridad, que establezca a quién se escala y quién decide. | Líder técnico | 27/11/2026 |
| Trasladaremos terraform apply al pipeline, después de la aprobación del pull request, y retiraremos los apply desde laptops. | Ingeniera de plataforma | 30/11/2026 |
| Capacitaremos a los desarrolladores en Terraform y definiremos un respaldo para los cambios en infra/ durante las ausencias de la ingeniera de plataforma. | Líder técnico | 04/12/2026 |

### Datos del repositorio

- SHA del commit que introdujo el cambio: bd600fe3307d5aa35bb3acbff8df91e0e02fcf35 (feat(infra): lectura de comprobantes para conciliacion)
- Fecha y hora de ese commit: 2026-11-06 17:42:00 -0500 (viernes 06/11, 17:42, hora de Lima)
- Checks de Checkov que fallan sobre el bucket de comprobantes (Checkov 3.4.5, checkov -d infra):
  - Exposición pública, introducidos por bd600fe (el commit anterior tenía los cuatro controles en true):
    - CKV_AWS_53 (block public ACLs), CKV_AWS_54 (block public policy), CKV_AWS_55 (ignore public ACLs) y CKV_AWS_56 (restrict public buckets), sobre aws_s3_bucket_public_access_block.comprobantes (infra/s3.tf, líneas 5 a 12).
    - CKV_AWS_70 (acción permitida a cualquier principal), sobre aws_s3_bucket_policy.conciliacion (infra/s3.tf, líneas 14 a 27).
    - CKV2_AWS_6 (public access block efectivo), sobre aws_s3_bucket.comprobantes (infra/s3.tf, líneas 1 a 3).
  - Otros hallazgos sobre aws_s3_bucket.comprobantes (infra/s3.tf, líneas 1 a 3):
    - CKV_AWS_18 (registros de acceso), causa de que el impacto no pueda medirse.
    - CKV_AWS_21 (versioning), CKV_AWS_145 (cifrado con KMS), CKV_AWS_144 (replicación entre regiones), CKV2_AWS_61 (configuración de lifecycle) y CKV2_AWS_62 (notificaciones de eventos).

## A2 · Decisiones

### Decisión 1 · Qué bloquea y qué informa

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

### Decisión 2 · La vulnerabilidad sin versión corregida

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

### Decisión 3 · La Function URL sin autenticación

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

## A3 · Dato nuevo

- Qué cambia en el postmortem:
- Qué cambia en las decisiones:
- Respuesta del equipo al pedido recibido:

## Parte B · Evidencia

| Evidencia | Link |
|---|---|
| Run fallido: el gate detiene el bucket público | |
| Run en verde en `main` después de las correcciones | |
| Pull requests del equipo | |

## Declaración de uso de IA

Herramientas usadas y para qué se usó cada una:
