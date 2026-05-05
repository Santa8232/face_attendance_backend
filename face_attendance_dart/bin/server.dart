import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_cors_headers/shelf_cors_headers.dart';

import '../lib/utils/config.dart';
import 'middleware/logger_middleware.dart';
import 'middleware/auth_middleware.dart';
import 'routes/auth_routes.dart';

void main(List<String> args) async {
  final router = Router();

  // Health check
  router.get('/health', (Request request) {
    return Response.ok(
      '{"status": "ok", "service": "Face Attendance API (Dart)", "time": "${DateTime.now().toIso8601String()}"}',
      headers: {'Content-Type': 'application/json'},
    );
  });

  // Mount routes
  router.mount('/api/auth/', AuthRoutes().router);
  router.mount('/api/v1/auth/', AuthRoutes().router);

  // Fallback for 404
  router.all('/<ignored|.*>', (Request request) {
    return Response.notFound(
      '{"success": false, "message": "Route not found"}',
      headers: {'Content-Type': 'application/json'},
    );
  });

  // Global Pipeline
  final handler = Pipeline()
      .addMiddleware(loggerMiddleware())
      .addMiddleware(corsHeaders())
      .addMiddleware(authMiddleware())
      .addHandler(router);

  final port = Config.port;
  final server = await serve(handler, InternetAddress.anyIPv4, port);
  
  print('🚀 Face Attendance API (Dart) → http://${server.address.host}:${server.port}');
}
