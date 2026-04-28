# Changelog

## [2026-04-28] - Database Migration & Vector Search Setup

### Added
- Created `data/teachers.json` for initial teacher data.
- Added sample users to `data/users.json` for Dr. Sarah Smith, Jane Doe, and Alex Johnson.
- Enabled `pgvector` support in `schema_suggested.sql` (requires manual extension installation).
- Standardized database primary keys to `id` across all tables.

### Fixed
- Resolved multiple syntax errors in `schema_suggested.sql` (missing commas, invalid data types, truncated table definitions).
- Fixed `BIT` vs `BOOLEAN` compatibility issues in PostgreSQL.
- Updated `migrateData_suggested.js` to correctly handle `email` and `mobile_no` fields during migration.
- Corrected import paths in database utility scripts (`cleanDB.js`).

### Manual Installation Steps Required for `pgvector`
To enable vector database features (face embedding similarity search), follow these steps:

1. **Locate PostgreSQL 17 installation**: Typically `C:\Program Files\PostgreSQL\17`.
2. **Copy vector.dll**:
   - Source: `src/db/suggested/pgvector-extracted/lib/vector.dll`
   - Destination: `C:\Program Files\PostgreSQL\17\lib\`
3. **Copy Extension Files**:
   - Source: `src/db/suggested/pgvector-extracted/share/extension/*`
   - Destination: `C:\Program Files\PostgreSQL\17\share\extension\`
4. **Restart PostgreSQL Service**:
   - Open `services.msc`, find `postgresql-x64-17`, and click **Restart**.
5. **Run Initialization**:
   - Run `node src/db/suggested/initDb_suggested.js --reset` to enable the extension in the database.
