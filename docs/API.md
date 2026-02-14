# VTMS Backend API (MongoDB) - Frontend Guide

Base URL:
- `{{HOST}}{{API_BASE}}` e.g. `http://localhost:4000/api/v1`

Pagination (all list endpoints):
- `page` (default 1)
- `perPage` allowed: `20`, `100`, `all` (all is capped server-side for safety)
Response includes:
- `meta: { page, perPage, total, totalPages }`

---

## Auth

### User login (Drivers/Supervisors)
`POST /auth/user/login`
```json
{ "email": "a@b.com", "password": "123456" }
```

### Employee login (Admin panel staff)
`POST /auth/employee/login`
```json
{ "email": "officer@vtms.com", "password": "123456" }
```

Use returned token in headers:
`Authorization: Bearer <token>`

---

## Media upload (images + watermark pipeline)

`POST /media/upload` (multipart form-data)
- field: `file`
- body fields:
  - `linkedTo`: `ACTIVITY` | `ATTENDANCE` | `CHAT_VOICE`
  - `kind`: `BEFORE` | `AFTER` | `SHIFT_START` | `SHIFT_END` | `VOICE`
  - `activityType` (optional): `FORK` / `GTS` etc
  - `activityId` (optional)
  - `attendanceId` (optional)
  - `meta` JSON string (optional): used for watermark text

Response:
- `mediaId` (save this in activity create API)
- `status` initially `PENDING` then becomes `DONE` by worker.

> In production you will replace local file URL logic with Hostinger storage upload/delete.

---

## Admin panel (Employees)

### Vehicle Types
- `GET /admin/vehicle-types`
- `POST /admin/vehicle-types`
- `PATCH /admin/vehicle-types/:id`
- `DELETE /admin/vehicle-types/:id`

### Vehicles
- `GET /admin/vehicles?q=KMC-123`
- `POST /admin/vehicles`
- `PATCH /admin/vehicles/:id`
- `DELETE /admin/vehicles/:id`

### Users (Drivers/Supervisors)
- `GET /admin/users?q=hr123`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `DELETE /admin/users/:id` (soft delete)

### Designations + Employees
- `GET /admin/designations`
- `POST /admin/designations`
- `PATCH /admin/designations/:id`
- `DELETE /admin/designations/:id`

- `GET /admin/employees?q=officer`
- `POST /admin/employees`
- `PATCH /admin/employees/:id`
- `DELETE /admin/employees/:id` (soft delete)

### Geo (Zones/UCs/Wards)
- `GET /admin/geo/zones`
- `POST /admin/geo/zones`
- `GET /admin/geo/ucs?zoneId=...`
- `POST /admin/geo/ucs`
- `GET /admin/geo/wards?ucId=...`
- `POST /admin/geo/wards`

### Bins
- `GET /admin/bins/bin08?wardId=...&q=BIN-12`
- `POST /admin/bins/bin08`
- `PATCH /admin/bins/bin08/:id`
- `GET /admin/bins/bin5?q=5C-123`
- `POST /admin/bins/bin5`

### Points (Kundi + GTS)
- `GET /admin/points/kundi?wardId=...`
- `POST /admin/points/kundi`
- `GET /admin/points/gts`
- `POST /admin/points/gts`

### Attendance
- `GET /admin/attendance?operationType=FORK&status=ONWORK&startDate=2026-01-01&endDate=2026-01-31`

### Dashboard KPIs
`GET /admin/dashboard/kpis?month=YYYY-MM`
Response:
```json
{
  "GATE": { "pending": 0, "approved": 0, "rejected": 0, "total": 0 },
  "FORK": { ... }
}
```

**Frontend charts:**  
Use any React chart library. Industry common:
- **Recharts** (clean + easy) for React dashboards
- **Chart.js** (via `react-chartjs-2`) for more chart types

---

## Approvals (VTMS Officer / Admin employee)

List:
`GET /admin/approvals/:operationType?status=PENDING&month=YYYY-MM&startDate=...&endDate=...&invoice=001&driverHr=...&supervisorHr=...`

Actions:
- `PATCH /admin/approvals/:operationType/:id/approve` body `{ "notes": "ok" }`
- `PATCH /admin/approvals/:operationType/:id/reject` body `{ "notes": "reason" }`
- `PATCH /admin/approvals/:operationType/:id/edit` body can update `notes`, `status`, `beforeMediaId`, `afterMediaId`

`operationType` values: `GATE | FORK | FLAP | ARM_ROLLER | BULK | GTS | LFS`

---

## Field operations (Mobile App)

Each operation has:
- `POST /operations/<op>/shift/start`
- `POST /operations/<op>/activity`
- `PATCH /operations/<op>/shift/:id/end`

**FORK (special):**
- `POST /operations/fork/shift/start` needs supervisor+driver hr and vehicleNumber
- `POST /operations/fork/activity` includes zone/uc/ward + binId OR manualBinNumber
- Server calculates `placed` based on bin radius.

---

## Notes for production

- Run **watermark worker** (BullMQ):
  - `npm run worker`
- Run cleanup scheduler:
  - `npm run cron`
- Use PM2 in production:
  - `pm2 start cluster.js -i max`
  - `pm2 start jobs/workers/watermark.worker.js -i 1`
  - `pm2 start jobs/schedulers/cron.js -i 1`

