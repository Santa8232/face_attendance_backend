import 'package:shelf/shelf.dart';

Middleware loggerMiddleware() {
  return (Handler innerHandler) {
    return (Request request) async {
      final watch = Stopwatch()..start();
      final response = await innerHandler(request);
      watch.stop();

      final method = request.method;
      final path = request.url.path;
      final status = response.statusCode;
      final elapsed = watch.elapsedMilliseconds;

      print('[$method] /$path - $status (${elapsed}ms)');
      
      return response;
    };
  };
}
