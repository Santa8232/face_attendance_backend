# Database Initialization Guide 🐘

This guide covers the steps required to initialize the PostgreSQL database and migrate existing JSON data into the new persistent storage layer using **auto-incrementing integer (SERIAL) primary keys**.

---

## 1. Environment Configuration

Ensure your `.env` file contains the correct PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=facial
```

---

## 2. Schema Initialization

To create the necessary tables and indices, run the initialization script. If you are updating an existing database and need to start fresh, use the `--reset` flag.

### **Fresh Setup / Reset**

> [!CAUTION]
> The `--reset` flag will drop all existing tables and data.

```bash
node src/db/initDb.js --reset
```

### **Standard Initialization**

```bash
node src/db/initDb.js
```

---

## 3. Data Migration (JSON to PostgreSQL)

If you have existing data in the `data/*.json` files, you can migrate them into the database using the migration script. This script automatically handles dependency ordering and validates foreign keys.

```bash
node src/db/migrateData.js
```

---

## 4. Verification

After migration, start the server to verify connectivity:

```bash
npm run dev
```

You should see the following in your logs:
`🐘 PostgreSQL connected successfully`

---

## Technical Notes

- **Biometric Data**: The schema includes a `face_embedding` column in `enrollment_samples` (JSONB) and `aggregate_embedding` in `face_templates`. These are essential for the face matching engine.
- **Aggregation**: The enrollment completion process now calculates a mathematical average of multiple face samples to increase verification accuracy.

---

## Troubleshooting

- **Authentication Failed**: Double-check your `DB_PASSWORD` in `.env`.
- **Database Does Not Exist**: Ensure you have created the database (e.g., `CREATE DATABASE facial;`) in PostgreSQL.
- **Foreign Key Violations**: The migration script will skip records with missing dependencies and log a warning. Check your JSON files for orphan records if important data is missing.
