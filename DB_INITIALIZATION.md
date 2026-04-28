# Database Initialization Guide 🐘

This guide covers the steps required to initialize the PostgreSQL database and migrate existing JSON data into the new persistent storage layer.

---

## 1. Prerequisites (Vector Database Support)

The system now uses **`pgvector`** for efficient face embedding similarity searches. You must install the extension manually on Windows before initializing the database.

### **Manual Installation Steps for Windows**
1. **Locate PostgreSQL 17 installation**: Typically `C:\Program Files\PostgreSQL\17`.
2. **Copy vector.dll**:
   - Source: `pgvector-extracted\lib\vector.dll` (found in your project root after extraction)
   - Destination: `C:\Program Files\PostgreSQL\17\lib\`
3. **Copy Extension Files**:
   - Source: `pgvector-extracted\share\extension\*`
   - Destination: `C:\Program Files\PostgreSQL\17\share\extension\`
4. **Restart PostgreSQL Service**:
   - Open `services.msc`, find `postgresql-x64-17`, and click **Restart**.

---

## 2. Environment Configuration

Ensure your `.env` file contains the correct PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=attendance_db
```

---

## 3. Schema Initialization

To create the necessary tables and indices, run the initialization script. Use the `--reset` flag to start with a fresh schema.

### **Fresh Setup / Reset**

> [!CAUTION]
> The `--reset` flag will drop all existing tables and data.

```bash
node src/db/suggested/initDb_suggested.js --reset
```

---

## 4. Data Migration (JSON to PostgreSQL)

To migrate data from `data/*.json` files into the database:

```bash
node src/db/suggested/migrateData_suggested.js
```

This script handles:
- **Institutions & Roles**
- **Departments & Courses**
- **Users** (with automatic mapping)
- **Students & Teachers**
- **Face Enrollments**

---

## 5. Verification

Start the server to verify connectivity:

```bash
npm run dev
```

You should see:
`🐘 PostgreSQL connected successfully`

---

## Troubleshooting

- **Extension "vector" is not available**: Ensure you have copied the `pgvector` files to the correct PostgreSQL directories and restarted the service.
- **Duplicate Key Violations**: If you encounter duplicate key errors during migration, run the initialization with `--reset` first.
- **Null Value Constraints**: Ensure your JSON files have all required fields (like `institution_id` for users).
