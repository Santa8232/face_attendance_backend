const swaggerJSDoc = require("swagger-jsdoc");

const definition = {
  openapi: "3.0.0",
  info: {
    title: "Face Attendance API",
    version: "1.0.0",
    description:
      "REST API for the Mobile Face Attendance System. \n\n" +
      "Data is stored in a persistent PostgreSQL database via an asynchronous store adapter.\n" +
      "Most endpoints require a Bearer JWT token obtained via `/api/v1/auth/login`.",
    contact: { name: "Backend Team" },
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev server" }],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Obtain a token via POST /api/v1/auth/login",
      },
    },

    schemas: {
      // ── Generic ────────────────────────────────────────────────────────────
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "OK" },
          data: { type: "object" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error description" },
        },
      },

      // ── Auth ───────────────────────────────────────────────────────────────
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: {
            type: "string",
            example: "EMP001",
            description: "email or employee_code",
          },
          password: { type: "string", example: "Emp@1234" },
          device_id: { type: "string", example: "a1b2c3d4e5" },
          device_name: { type: "string", example: "Pixel 8" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              access_token: {
                type: "string",
                description: "JWT token (8 h expiry)",
              },
              refresh_token: {
                type: "string",
                description: "Refresh token (7 d expiry)",
              },
              employee: {
                type: "object",
                properties: {
                  employee_id: { type: "string", format: "uuid" },
                  employee_code: { type: "string" },
                  name: { type: "string" },
                  role: { type: "string", enum: ["admin", "hr", "employee"] },
                  office_id: { type: "string" },
                },
              },
            },
          },
        },
      },

      // ── Employee ───────────────────────────────────────────────────────────
      Employee: {
        type: "object",
        properties: {
          employee_id: { type: "string", format: "uuid" },
          user_id: { type: "string", nullable: true },
          office_id: { type: "string" },
          department_id: { type: "string", nullable: true },
          shift_id: { type: "string", nullable: true },
          employee_code: { type: "string", example: "EMP001" },
          full_name: { type: "string", example: "John Doe" },
          email: { type: "string", format: "email" },
          phone: { type: "string", nullable: true },
          designation: { type: "string", nullable: true },
          employment_type: {
            type: "string",
            enum: ["FULL_TIME", "PART_TIME", "CONTRACT"],
          },
          is_active: { type: "boolean" },
          face_enrolled: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },

      // ── Master Data ────────────────────────────────────────────────────────
      Office: {
        type: "object",
        properties: {
          office_id: { type: "string", format: "uuid" },
          office_name: { type: "string", example: "HQ" },
          address: { type: "string", nullable: true },
          city: { type: "string", example: "Mumbai" },
          country: { type: "string", example: "India" },
          timezone: { type: "string", example: "Asia/Kolkata" },
          latitude: { type: "number", nullable: true },
          longitude: { type: "number", nullable: true },
          is_active: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Department: {
        type: "object",
        properties: {
          department_id: { type: "string", format: "uuid" },
          office_id: { type: "string", format: "uuid" },
          department_name: { type: "string", example: "Engineering" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Shift: {
        type: "object",
        properties: {
          shift_id: { type: "string", format: "uuid" },
          office_id: { type: "string", format: "uuid" },
          shift_name: { type: "string", example: "Day Shift" },
          start_time: { type: "string", example: "09:00" },
          end_time: { type: "string", example: "18:00" },
          grace_minutes: { type: "integer", example: 15 },
          is_active: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },

      // ── Attendance ─────────────────────────────────────────────────────────
      AttendanceRequest: {
        type: "object",
        properties: {
          employee_id: {
            type: "string",
            format: "uuid",
            description: "Optional; inferred from JWT if missing",
          },
          device_id: { type: "string", example: "device-uuid-123" },
          verification_token: {
            type: "string",
            description:
              "Token from /face/verify (required if match/liveness not sent)",
          },
          timestamp: { type: "string", format: "date-time" },
          location: {
            type: "object",
            properties: {
              latitude: { type: "number", example: 24.817 },
              longitude: { type: "number", example: 93.9368 },
              accuracy_m: { type: "number", example: 10 },
            },
          },
          network_mode: {
            type: "string",
            enum: ["ONLINE", "OFFLINE"],
            default: "ONLINE",
          },
          remarks: { type: "string", nullable: true },
        },
      },
      AttendanceLog: {
        type: "object",
        properties: {
          attendance_id: { type: "string", format: "uuid" },
          employee_id: { type: "string" },
          office_id: { type: "string" },
          event_type: { type: "string", enum: ["CHECK_IN", "CHECK_OUT"] },
          attendance_date: { type: "string", format: "date" },
          event_timestamp: { type: "string", format: "date-time" },
          geofence_status: {
            type: "string",
            enum: ["INSIDE", "OUTSIDE", "SKIPPED"],
          },
          face_match_score: { type: "number" },
          liveness_score: { type: "number" },
          verification_status: { type: "string" },
          shift_status: {
            type: "string",
            enum: ["on_time", "late", "very_late", "checked_out", "no_shift"],
          },
          offline_flag: { type: "boolean" },
          selfie_image_url: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },

  security: [{ bearerAuth: [] }],

  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        security: [],
        responses: { 200: { description: "Server is up" } },
      },
    },

    // ── Auth (v1) ───────────────────────────────────────────────────────────
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive access/refresh tokens",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange refresh token for new access token",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refresh_token: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Token refreshed" } },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and revoke refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refresh_token: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/api/v1/auth/request-otp": {
      post: {
        tags: ["Auth"],
        summary: "Request OTP for passwordless login",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  employee_code: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OTP sent" } },
      },
    },
    "/api/v1/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP and receive tokens",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  employee_code: { type: "string" },
                  otp: { type: "string" },
                  device_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Verified" } },
      },
    },

    // ── Employees (v1) ───────────────────────────────────────────────────────
    "/api/v1/employees": {
      get: {
        tags: ["Employees"],
        summary: "List employees (ADMIN / HR)",
        parameters: [
          { name: "office_id", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["active", "inactive"] },
          },
        ],
        responses: { 200: { description: "Employee list" } },
      },
      post: {
        tags: ["Employees"],
        summary: "Create employee (ADMIN)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Employee" },
            },
          },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/api/v1/employees/me": {
      get: {
        tags: ["Employees"],
        summary: "Get own profile",
        responses: { 200: { description: "Own profile" } },
      },
    },
    "/api/v1/employees/{id}/status": {
      patch: {
        tags: ["Employees"],
        summary: "Change employee status (ADMIN)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["active", "inactive"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Status updated" } },
      },
    },

    // ── Face Module (v1) ─────────────────────────────────────────────────────
    "/api/v1/face/enrollment/start": {
      post: {
        tags: ["Face Enrollment"],
        summary: "Start enrollment session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  employee_id: { type: "string" },
                  device_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Session started" } },
      },
    },
    "/api/v1/face/enrollment/sample": {
      post: {
        tags: ["Face Enrollment"],
        summary: "Upload enrollment sample (Base64 or Multipart)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  session_id: { type: "string" },
                  image: { type: "string", format: "binary" },
                  quality_score: { type: "number" },
                  liveness_score: { type: "number" },
                },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  session_id: { type: "string" },
                  image_base64: { type: "string" },
                  quality_score: { type: "number" },
                  liveness_score: { type: "number" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Sample received" } },
      },
    },
    "/api/v1/face/enrollment/complete": {
      post: {
        tags: ["Face Enrollment"],
        summary: "Finalize enrollment flow",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { session_id: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Completed" } },
      },
    },
    "/api/v1/face/enrollment/{template_id}/approve": {
      post: {
        tags: ["Face Enrollment"],
        summary: "Approve enrollment (ADMIN / HR)",
        parameters: [
          {
            name: "template_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Approved" } },
      },
    },
    "/api/v1/face/enrollment/{employee_id}/reset": {
      post: {
        tags: ["Face Enrollment"],
        summary: "Reset enrollment (ADMIN)",
        parameters: [
          {
            name: "employee_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Reset" } },
      },
    },
    "/api/v1/face/verify": {
      post: {
        tags: ["Face Verification"],
        summary: "Verify face and get short-lived token",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  employee_id: {
                    type: "string",
                    description: "Optional; inferred from JWT",
                  },
                  image: { type: "string", format: "binary" },
                },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  employee_id: { type: "string" },
                  image_base64: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Verification successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { verification_token: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },

    // ── Attendance (v1) ──────────────────────────────────────────────────────
    "/api/v1/attendance/check-in": {
      post: {
        tags: ["Attendance"],
        summary: "Record check-in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AttendanceRequest" },
            },
          },
        },
        responses: { 200: { description: "Check-in recorded" } },
      },
    },
    "/api/v1/attendance/check-out": {
      post: {
        tags: ["Attendance"],
        summary: "Record check-out",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AttendanceRequest" },
            },
          },
        },
        responses: { 200: { description: "Check-out recorded" } },
      },
    },
    "/api/v1/attendance/my": {
      get: {
        tags: ["Attendance"],
        summary: "Get own attendance history",
        parameters: [
          {
            name: "month",
            in: "query",
            schema: { type: "string", example: "2026-04" },
          },
        ],
        responses: { 200: { description: "Attendance records" } },
      },
    },
    "/api/v1/attendance/sync": {
      post: {
        tags: ["Attendance"],
        summary: "Batch sync offline events",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  device_id: { type: "string" },
                  events: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Sync complete" } },
      },
    },

    // ── Management (v1) ──────────────────────────────────────────────────────
    "/api/v1/shifts": {
      get: {
        tags: ["Management"],
        summary: "List shifts",
        parameters: [
          { name: "office_id", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Shift" },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/shifts/assign": {
      post: {
        tags: ["Management"],
        summary: "Assign shift to employee",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  employee_id: { type: "string" },
                  shift_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Assigned" } },
      },
    },
    "/api/v1/policies/attendance": {
      get: {
        tags: ["Management"],
        summary: "Get attendance policy",
        parameters: [
          { name: "office_id", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/v1/geofences": {
      get: {
        tags: ["Management"],
        summary: "List geofences",
        parameters: [
          { name: "office_id", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
    },
    "/api/v1/geofences/validate": {
      post: {
        tags: ["Management"],
        summary: "Validate coordinates against geofence",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  office_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/devices/register": {
      post: {
        tags: ["Management"],
        summary: "Register device",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/exceptions": {
      get: {
        tags: ["Exceptions"],
        summary: "List exceptions",
        responses: { 200: { description: "OK" } },
      },
      post: {
        tags: ["Exceptions"],
        summary: "Raise exception",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 201: { description: "Raised" } },
      },
    },
    "/api/v1/exceptions/{id}/review": {
      post: {
        tags: ["Exceptions"],
        summary: "Review exception",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Reviewed" } },
      },
    },
    "/api/v1/reports/daily-summary": {
      get: {
        tags: ["Reports"],
        summary: "Daily summary report",
        responses: { 200: { description: "OK" } },
      },
    },
  },
};

const options = {
  definition,
  apis: [], // Defined inline for maximum portability in this phase
};

module.exports = swaggerJSDoc(options);
