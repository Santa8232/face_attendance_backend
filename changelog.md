# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-19

### Fixed
- **Face Enrollment Pipeline**: Resolved 500 errors during enrollment completion by aligning column names with PostgreSQL schema (`template_data` -> `aggregate_embedding`, `status` -> `approval_status`).
- **Database Schema**: Fixed primary key types and column names across biometric tables.
- **Identifier Consistency**: Added support for both Integer (SERIAL) and UUID identifiers in employee lookups to prevent database type mismatches.
- **Face Template Logic**: Resolved "missing biometric data" during verification by adding proper embedding storage and aggregation. Successfully verified real-time similarity matching (e.g., 0.7031).

### Changed
- **Biometric Storage**: Updated `face_templates` to store JSONB aggregate embeddings.
- **Diagnostic Mode**: Temporarily enabled `upload.any()` and detailed logging for multipart requests to debug Flutter client integration.

### Added
- **Embedding Support**: Added `face_embedding` column to `enrollment_samples` for better template accuracy.
- **Diagnostic Logging**: Comprehensive request body and file logging in `enrollment` and `verification` controllers.

## [1.0.0] - 2026-04-18

### Added
- Initial release with Face Attendance features.
- Geofencing and Shift management.
- Offline sync support.
