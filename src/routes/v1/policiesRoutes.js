const router = require('express').Router();
const ctrl   = require('../../controllers/v1/shiftsController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get ('/attendance',  ctrl.getAttendancePolicy);
router.post('/attendance',  authorize('ADMIN'), ctrl.upsertAttendancePolicy);

module.exports = router;
