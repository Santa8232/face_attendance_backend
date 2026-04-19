const router = require('express').Router();
const ctrl   = require('../../controllers/attendanceController');
const { authenticate, authorize } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.use(authenticate);
router.use((req, _res, next) => { req.uploadSubDir = 'attendance'; next(); });

// Employee-facing
router.post('/check-in',       upload.single('selfie'), ctrl.checkIn);
router.post('/check-out',      upload.single('selfie'), ctrl.checkOut);
router.post('/sync',           ctrl.syncOffline);
router.get ('/my',             ctrl.getMyAttendance);

// Admin / HR
router.get ('/today-summary',  authorize('ADMIN', 'HR'), ctrl.todaySummary);
router.get ('/daily-summary',  ctrl.getDailySummary);
router.get ('/',               ctrl.listAttendance);

module.exports = router;
