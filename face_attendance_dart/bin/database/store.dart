import 'package:postgres/postgres.dart';
import 'database_connection.dart';

class Store {
  /// Fetches all records from a table.
  static Future<List<Map<String, dynamic>>> getAll(String table) async {
    final pool = await DatabaseConnection.pool;
    final result = await pool.execute('SELECT * FROM $table');
    return result.map((row) => row.toColumnMap()).toList();
  }

  /// Fetches a single record by ID or a specific field.
  static Future<Map<String, dynamic>?> getById(String table, dynamic id, {String field = 'id'}) async {
    final pool = await DatabaseConnection.pool;
    final result = await pool.execute(
      Sql.named('SELECT * FROM $table WHERE $field = @id LIMIT 1'),
      parameters: {'id': id},
    );
    return result.isEmpty ? null : result.first.toColumnMap();
  }

  /// Finds a single record matching the predicate.
  static Future<Map<String, dynamic>?> findOne(String table, Map<String, dynamic> predicate) async {
    final pool = await DatabaseConnection.pool;
    if (predicate.isEmpty) return null;

    final keys = predicate.keys.toList();
    final where = keys.map((k) => '$k = @$k').join(' AND ');

    final result = await pool.execute(
      Sql.named('SELECT * FROM $table WHERE $where LIMIT 1'),
      parameters: predicate,
    );
    return result.isEmpty ? null : result.first.toColumnMap();
  }

  /// Finds multiple records matching the predicate.
  static Future<List<Map<String, dynamic>>> findMany(String table, Map<String, dynamic> predicate) async {
    final pool = await DatabaseConnection.pool;
    if (predicate.isEmpty) return getAll(table);

    final keys = predicate.keys.toList();
    final where = keys.map((k) => '$k = @$k').join(' AND ');

    final result = await pool.execute(
      Sql.named('SELECT * FROM $table WHERE $where'),
      parameters: predicate,
    );
    return result.map((row) => row.toColumnMap()).toList();
  }

  /// Inserts a new record into the table.
  static Future<Map<String, dynamic>> insert(String table, Map<String, dynamic> record) async {
    final pool = await DatabaseConnection.pool;
    final keys = record.keys.toList();
    final cols = keys.join(', ');
    final placeholders = keys.map((k) => '@$k').join(', ');

    final result = await pool.execute(
      Sql.named('INSERT INTO $table ($cols) VALUES ($placeholders) RETURNING *'),
      parameters: record,
    );
    return result.first.toColumnMap();
  }

  /// Updates an existing record.
  static Future<Map<String, dynamic>?> update(String table, dynamic id, Map<String, dynamic> changes, {String field = 'id'}) async {
    final pool = await DatabaseConnection.pool;
    if (changes.isEmpty) return getById(table, id, field: field);

    final keys = changes.keys.toList();
    final setClause = keys.map((k) => '$k = @$k').join(', ');
    
    final parameters = Map<String, dynamic>.from(changes);
    parameters['id_val_where'] = id;

    // Use a different placeholder for the WHERE clause to avoid collision
    final result = await pool.execute(
      Sql.named('UPDATE $table SET $setClause WHERE $field = @id_val_where RETURNING *'),
      parameters: parameters,
    );
    return result.isEmpty ? null : result.first.toColumnMap();
  }

  /// Removes a record from the table.
  static Future<bool> remove(String table, dynamic id, {String field = 'id'}) async {
    final pool = await DatabaseConnection.pool;
    final result = await pool.execute(
      Sql.named('DELETE FROM $table WHERE $field = @id'),
      parameters: {'id': id},
    );
    return result.affectedRows > 0;
  }
}
