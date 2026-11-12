
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

  # Control compensatorio: limitar ejecuciones simultaneas
  reserved_concurrent_executions = 5

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
  #checkov:skip=CKV_AWS_258:Excepcion temporal hasta 31-12-2026
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}
