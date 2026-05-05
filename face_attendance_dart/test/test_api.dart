import 'package:http/http.dart' as http;
import 'dart:convert';

void main() async {
  final url = Uri.parse('http://localhost:3000/api/auth/login');
  final response = await http.post(
    url,
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'username': 'test', 'password': 'test'}),
  );

  print('Status: ${response.statusCode}');
  print('Body: ${response.body}');
}
