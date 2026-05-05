class UserModel {
  final int? id;
  final int? institutionId;
  final String username;
  final String passwordHash;
  final String fullName;
  final String? mobileNo;
  final String? email;
  final DateTime? lastLoginAt;
  final int? userRoleId;
  final bool isActive;
  final DateTime? createdAt;

  UserModel({
    this.id,
    this.institutionId,
    required this.username,
    required this.passwordHash,
    required this.fullName,
    this.mobileNo,
    this.email,
    this.lastLoginAt,
    this.userRoleId,
    this.isActive = true,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      institutionId: json['institution_id'],
      username: json['username'],
      passwordHash: json['password_hash'],
      fullName: json['full_name'],
      mobileNo: json['mobile_no'],
      email: json['email'],
      lastLoginAt: json['last_login_at'],
      userRoleId: json['user_role_id'],
      isActive: json['is_active'] ?? true,
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'institution_id': institutionId,
      'username': username,
      'password_hash': passwordHash,
      'full_name': fullName,
      'mobile_no': mobileNo,
      'email': email,
      'last_login_at': lastLoginAt?.toIso8601String(),
      'user_role_id': userRoleId,
      'is_active': isActive,
      if (createdAt != null) 'created_at': createdAt?.toIso8601String(),
    };
  }
}
