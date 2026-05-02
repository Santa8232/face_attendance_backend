const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// GET /api/v1/reports/daily-summary?office_id=4&date=2026-04-18
const dailySummary = asyncHandler(async (req, res) => {
  const { office_id, date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const logs = await store.findMany(TABLES.ATTENDANCE_LOGS, l =>
    l.attendance_date === targetDate &&
    (!office_id || String(l.office_id) === String(office_id)),
  );

  const employees = await store.findMany(TABLES.EMPLOYEES, e =>
    e.is_active && (!office_id || String(e.office_id) === String(office_id)),
  );

  const checkedIn  = new Set(logs.filter(l => l.event_type === 'CHECK_IN').map(l => l.employee_id));
  const checkedOut = new Set(logs.filter(l => l.event_type === 'CHECK_OUT').map(l => l.employee_id));
  const lateArrivals = logs.filter(l => l.event_type === 'CHECK_IN' && l.shift_status === 'late' || l.shift_status === 'very_late');

  const presentIds = [...checkedIn];
  const absentIds  = employees.filter(e => !checkedIn.has(e.employee_id)).map(e => e.employee_id);

  return ok(res, {
    date:              targetDate,
    office_id:         office_id || null,
    total_employees:   employees.length,
    present:           checkedIn.size,
    absent:            absentIds.length,
    checked_out:       checkedOut.size,
    still_in_office:   checkedIn.size - checkedOut.size,
    late_arrivals:     lateArrivals.length,
    absent_employees:  absentIds,
    present_employees: presentIds,
  });
});

// GET /api/v1/reports/late-arrivals?office_id=4&month=2026-04
const lateArrivals = asyncHandler(async (req, res) => {
  const { office_id, month } = req.query;
  if (!month) return fail(res, 'month query param is required (YYYY-MM)');

  const logs = await store.findMany(TABLES.ATTENDANCE_LOGS, l =>
    l.event_type === 'CHECK_IN' &&
    l.attendance_date?.startsWith(month) &&
    (l.shift_status === 'late' || l.shift_status === 'very_late') &&
    (!office_id || String(l.office_id) === String(office_id)),
  );

  // Enrich with employee name
  const enriched = [];
  for (const l of logs) {
    const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', l.employee_id);
    enriched.push({
      attendance_id:   l.attendance_id,
      employee_id:     l.employee_id,
      employee_code:   emp?.employee_code || null,
      employee_name:   emp?.full_name     || null,
      date:            l.attendance_date,
      check_in_time:   l.event_timestamp,
      shift_status:    l.shift_status,
    });
  }

  enriched.sort((a, b) => a.date.localeCompare(b.date));

  return ok(res, {
    month, office_id: office_id || null,
    total_late: enriched.length,
    records:    enriched,
  });
});

// GET /api/v1/reports/monthly-export?office_id=4&month=2026-04&format=csv
const monthlyExport = asyncHandler(async (req, res) => {
  const { office_id, month, format = 'json' } = req.query;
  if (!month) return fail(res, 'month query param is required (YYYY-MM)');

  const employees = await store.findMany(TABLES.EMPLOYEES, e =>
    e.is_active && (!office_id || String(e.office_id) === String(office_id)),
  );

  const summaries = await store.findMany(TABLES.ATTENDANCE_SUMMARY, s =>
    s.attendance_date?.startsWith(month) &&
    (!office_id || employees.some(e => e.employee_id === s.employee_id)),
  );

  const rows = [];
  for (const s of summaries) {
    const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', s.employee_id);
    rows.push({
      employee_id:        s.employee_id,
      employee_code:      emp?.employee_code || '',
      employee_name:      emp?.full_name     || '',
      date:               s.attendance_date,
      first_check_in:     s.first_check_in   || '',
      last_check_out:     s.last_check_out   || '',
      total_work_minutes: s.total_work_minutes || 0,
      total_work_hours:   s.total_work_minutes
        ? (s.total_work_minutes / 60).toFixed(2)
        : '0.00',
      day_status:         s.day_status || 'PRESENT',
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.employee_code.localeCompare(b.employee_code));

  if (format === 'csv') {
    const headers = Object.keys(rows[0] || {}).join(',');
    const csvRows = rows.map(r => Object.values(r).map(v => `"${v}"`).join(','));
    const csv     = [headers, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${month}.csv"`);
    return res.send(csv);
  }

  return ok(res, {
    month, office_id: office_id || null,
    total_records: rows.length,
    records: rows,
  });
});

module.exports = { dailySummary, lateArrivals, monthlyExport };
