import 'package:dotenv/dotenv.dart';

class Config {
  static final DotEnv _env = DotEnv()..load();

  static String get(String key, {String defaultValue = ''}) {
    return _env[key] ?? defaultValue;
  }

  static int getInt(String key, {int defaultValue = 0}) {
    return int.tryParse(_env[key] ?? '') ?? defaultValue;
  }

  static String get jwtSecret => get('JWT_SECRET', defaultValue: 'super_secret_attendance_key_2026');
  static String get refreshSecret => get('REFRESH_SECRET', defaultValue: 'refresh_secret_attendance_key_2026');
  static String get jwtExpiresIn => get('JWT_EXPIRES_IN', defaultValue: '8h');
  
  static int get port => getInt('PORT', defaultValue: 3000);
}
