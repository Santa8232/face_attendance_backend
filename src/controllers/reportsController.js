const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// GET /api/v1/reports/daily-summary?office_id=4&date=2026-04-18
const dailySummary = asyncHandler(async (req, res) => {
  const { office_id, date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const offId = office_id ? parseInt(office_id) : null;

  const logs = await store.findMany(TABLES.ATTENDANCE_LOGS, l =>
    String(l.attendance_date).slice(0, 10) === targetDate &&
    (!offId || l.office_id === offId)
  );

  const employees = await store.findMany(TABLES.EMPLOYEES, e =>
    e.is_active && (!offId || e.office_id === offId)
  );

  const checkedIn  = new Set(logs.filter(l => l.event_type === 'CHECK_IN').map(l => l.employee_id));
  const checkedOut = new Set(logs.filter(l => l.event_type === 'CHECK_OUT').map(l => l.employee_id));
  const lateArrivals = logs.filter(l => l.event_type === 'CHECK_IN' && (l.shift_status === 'late' || l.shift_status === 'very_late'));

  const presentIds = [...checkedIn];
  const absentIds  = employees.filter(e => !checkedIn.has(e.id)).map(e => e.id);

  return ok(res, {
    date:              targetDate,
    office_id:         offId,
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
  const offId = office_id ? parseInt(office_id) : null;

  const logs = await store.findMany(TABLES.ATTENDANCE_LOGS, l =>
    l.event_type === 'CHECK_IN' &&
    String(l.attendance_date).startsWith(month) &&
    (l.shift_status === 'late' || l.shift_status === 'very_late') &&
    (!offId || l.office_id === offId)
  );

  const enriched = [];
  for (const l of logs) {
    const emp = await store.getById(TABLES.EMPLOYEES, l.employee_id);
    enriched.push({
      attendance_id:   l.attendance_id,
      id:              l.id,
      employee_id:     l.employee_id,
      employee_code:   emp?.employee_code || null,
      employee_name:   emp?.full_name     || null,
      date:            l.attendance_date,
      check_in_time:   l.event_timestamp,
      shift_status:    l.shift_status,
    });
  }

  enriched.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return ok(res, {
    month, office_id: offId,
    total_late: enriched.length,
    records:    enriched,
  });
});

// GET /api/v1/reports/monthly-export?office_id=4&month=2026-04&format=csv
const monthlyExport = asyncHandler(async (req, res) => {
  const { office_id, month, format = 'json' } = req.query;
  if (!month) return fail(res, 'month query param is required (YYYY-MM)');
  const offId = office_id ? parseInt(office_id) : null;

  const employees = await store.findMany(TABLES.EMPLOYEES, e =>
    e.is_active && (!offId || e.office_id === offId)
  );
  const empIds = new Set(employees.map(e => e.id));

  const summaries = await store.findMany(TABLES.ATTENDANCE_SUMMARY, s =>
    String(s.attendance_date).startsWith(month) &&
    empIds.has(s.employee_id)
  );

  const rows = [];
  for (const s of summaries) {
    const emp = await store.getById(TABLES.EMPLOYEES, s.employee_id);
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

  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.employee_code.localeCompare(b.employee_code));

  if (format === 'csv') {
    if (!rows.length) return res.send('No data');
    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(r => Object.values(r).map(v => `"${v}"`).join(','));
    const csv     = [headers, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${month}.csv"`);
    return res.send(csv);
  }

  return ok(res, {
    month, office_id: offId,
    total_records: rows.length,
    records: rows,
  });
});

module.exports = { dailySummary, lateArrivals, monthlyExport };
