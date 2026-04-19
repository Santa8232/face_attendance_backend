const router = require('express').Router();
const ctrl   = require('../../controllers/employeeController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get   ('/me',              ctrl.getMyProfile);
router.get   ('/',                authorize('ADMIN','HR'), ctrl.listEmployees);
router.get   ('/:id',             authorize('ADMIN','HR'), ctrl.getEmployee);
router.post  ('/',                authorize('ADMIN'),       ctrl.createEmployee);
router.put   ('/:id',             authorize('ADMIN','HR'), ctrl.updateEmployee);
router.patch ('/:id/status',      authorize('ADMIN'),       ctrl.updateStatus);

module.exports = router;
