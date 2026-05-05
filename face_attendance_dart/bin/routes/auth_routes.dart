import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:bcrypt/bcrypt.dart';
import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import '../database/store.dart';
import '../database/tables.dart';
import '../../lib/utils/config.dart';

class AuthRoutes {
  Router get router {
    final router = Router();

    // POST /login
    router.post('/login', (Request request) async {
      final payload = jsonDecode(await request.readAsString());
      final String? username = payload['username'];
      final String? password = payload['password'];

      if (username == null || password == null) {
        return Response(400, body: jsonEncode({'success': false, 'message': 'username and password are required'}), headers: {'Content-Type': 'application/json'});
      }

      // Find user
      final user = await Store.findOne(Tables.users, {
        'username': username.trim(),
      });

      if (user == null) {
        // Try finding by email
        final userByEmail = await Store.findOne(Tables.users, {
          'email': username.toLowerCase().trim(),
        });
        if (userByEmail == null) {
          return Response(401, body: jsonEncode({'success': false, 'message': 'Invalid credentials'}), headers: {'Content-Type': 'application/json'});
        }
        return _handleLogin(userByEmail, password, payload);
      }

      return _handleLogin(user, password, payload);
    });

    return router;
  }

  Future<Response> _handleLogin(Map<String, dynamic> user, String password, Map<String, dynamic> body) async {
    if (user['is_active'] == false) {
      return Response(401, body: jsonEncode({'success': false, 'message': 'Account deactivated'}), headers: {'Content-Type': 'application/json'});
    }

    final String? passwordHash = user['password_hash'] ?? user['password'];
    if (passwordHash == null) {
      return Response(401, body: jsonEncode({'success': false, 'message': 'User has no password set'}), headers: {'Content-Type': 'application/json'});
    }

    final match = BCrypt.checkpw(password, passwordHash);
    if (!match) {
      return Response(401, body: jsonEncode({'success': false, 'message': 'Invalid credentials'}), headers: {'Content-Type': 'application/json'});
    }

    // Fetch Role
    String role = 'USER';
    if (user['user_role_id'] != null) {
      final roleRecord = await Store.getById(Tables.userRoles, user['user_role_id']);
      if (roleRecord != null) {
        role = roleRecord['role_name'];
      }
    }

    // Issue Tokens
    final jwtPayload = {
      'user_id': user['id'],
      'email': user['email'],
      'role': role,
    };

    final accessToken = JWT(jwtPayload).sign(SecretKey(Config.jwtSecret), expiresIn: Duration(hours: 8));
    final refreshToken = JWT({'user_id': user['id']}).sign(SecretKey(Config.refreshSecret), expiresIn: Duration(days: 7));

    // Update Device Registry (Stub for now, can be implemented similar to Node.js)
    final deviceId = body['device_id'];
    if (deviceId != null) {
      // Implement device registry logic here if needed
    }

    return Response.ok(
      jsonEncode({
        'success': true,
        'message': 'Login successful',
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'user': {
          'id': user['id'],
          'username': user['username'],
          'email': user['email'],
          'role': role,
          'face_enrolled': user['face_enrolled'] ?? false,
        }
      }),
      headers: {'Content-Type': 'application/json'},
    );
  }
}
