import 'package:postgres/postgres.dart';
import 'package:dotenv/dotenv.dart';
import 'dart:io';

class DatabaseConnection {
  static Pool? _pool;

  static Future<Pool> get pool async {
    if (_pool == null) {
      var env = DotEnv()..load();
      
      final host = env['DB_HOST'] ?? 'localhost';
      final port = int.parse(env['DB_PORT'] ?? '5432');
      final database = env['DB_NAME'] ?? 'facial';
      final username = env['DB_USER'] ?? 'postgres';
      final password = env['DB_PASSWORD'] ?? 'root';

      print('🐘 Connecting to PostgreSQL at $host:$port/$database...');

      try {
        _pool = Pool.withEndpoints(
          [
            Endpoint(
              host: host,
              port: port,
              database: database,
              username: username,
              password: password,
            )
          ],
          settings: PoolSettings(
            maxConnectionCount: 10,
            sslMode: SslMode.disable,
          ),
        );
        
        // Test connection
        final result = await _pool!.execute('SELECT 1');
        if (result.isNotEmpty) {
          print('✅ PostgreSQL connected successfully');
        }
      } catch (e) {
        print('❌ PostgreSQL connection failed: $e');
        exit(1);
      }
    }
    return _pool!;
  }

  static Future<void> close() async {
    await _pool?.close();
    _pool = null;
  }
}
