import 'package:shelf/shelf.dart';
import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import '../../lib/utils/config.dart';

Middleware authMiddleware() {
  return (Handler innerHandler) {
    return (Request request) async {
      // Exclude public routes and health check
      final path = request.url.path;
      if (path == 'health' || 
          path.startsWith('api/auth') || 
          path.startsWith('api/v1/auth') ||
          path.startsWith('api-docs') ||
          path.startsWith('uploads')) {
        return innerHandler(request);
      }

      final authHeader = request.headers['Authorization'];
      if (authHeader == null || !authHeader.startsWith('Bearer ')) {
        return Response(401, body: '{"success": false, "message": "Missing or invalid authorization header"}', headers: {'Content-Type': 'application/json'});
      }

      final token = authHeader.substring(7);
      final secret = Config.jwtSecret;

      try {
        final jwt = JWT.verify(token, SecretKey(secret));
        
        // Add user info to context for controllers to use
        final updatedRequest = request.change(context: {'user': jwt.payload});
        return await innerHandler(updatedRequest);
      } on JWTExpiredException {
        return Response(401, body: '{"success": false, "message": "Token expired"}', headers: {'Content-Type': 'application/json'});
      } on JWTException catch (e) {
        return Response(401, body: '{"success": false, "message": "Invalid token: ${e.message}"}', headers: {'Content-Type': 'application/json'});
      } catch (e) {
        return Response(500, body: '{"success": false, "message": "Internal auth error"}', headers: {'Content-Type': 'application/json'});
      }
    };
  };
}
