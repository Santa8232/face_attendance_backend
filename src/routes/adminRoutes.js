const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('ADMIN', 'HR'));

// Offices
router.get ('/offices',       ctrl.listOffices);
router.post('/offices',       authorize('ADMIN'), ctrl.createOffice);
router.put ('/offices/:id',   authorize('ADMIN'), ctrl.updateOffice);

// Departments
router.get ('/departments',   ctrl.listDepartments);
router.post('/departments',   authorize('ADMIN'), ctrl.createDepartment);

// Shifts
router.get ('/shifts',        ctrl.listShifts);
router.post('/shifts',        authorize('ADMIN'), ctrl.createShift);
router.put ('/shifts/:id',    authorize('ADMIN'), ctrl.updateShift);

// Geofences
router.get ('/geofences',     ctrl.listGeofences);
router.post('/geofences',     authorize('ADMIN'), ctrl.createGeofence);
router.put ('/geofences/:id', authorize('ADMIN'), ctrl.updateGeofence);

// Policies
router.get ('/policies/:officeId', ctrl.getPolicyByOffice);
router.post('/policies',           authorize('ADMIN'), ctrl.upsertPolicy);

// Exceptions
router.get ('/exceptions',         ctrl.listExceptions);
router.post('/exceptions/:id/review', authorize('ADMIN','HR'), ctrl.reviewException);

// Audit logs
router.get ('/audit-logs',    ctrl.listAuditLogs);

module.exports = router;
