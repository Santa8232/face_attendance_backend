const router = require('express').Router();
const ctrl   = require('../controllers/reportsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('ADMIN','HR'));

router.get('/daily-summary',   ctrl.dailySummary);
router.get('/late-arrivals',   ctrl.lateArrivals);
router.get('/monthly-export',  ctrl.monthlyExport);

module.exports = router;
