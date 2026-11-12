resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.proyecto}-api-${var.ambiente}"
  retention_in_days = 7
}

resource "aws_lambda_function" "api" {
  function_name = "${var.proyecto}-api-${var.ambiente}"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:${var.version_imagen}"
  timeout       = 10
  memory_size   = 256
  # Control compensatorio de la excepcion CKV_AWS_258 (Decision 3).
  reserved_concurrent_executions = 50

  environment {
    variables = {
      BUCKET_COMPROBANTES = aws_s3_bucket.comprobantes.bucket
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_lambda_function_url" "api" {
  # checkov:skip=CKV_AWS_258:Excepcion Decision 3. La app movil consume la URL sin firmar con AWS.
  # Responsable: lider tecnico
  # Vencimiento: 2026-12-31 (la API pasa detras de un punto de entrada que valida el token)
  # Control compensatorio: reserved_concurrent_executions en aws_lambda_function.api y revision de aws_cloudwatch_log_group.api
  # Riesgo aceptado: cualquier cliente de Internet puede invocar la URL; la API no valida identidad
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}
