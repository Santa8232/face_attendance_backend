const router = require('express').Router();
const ctrl   = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

// Set upload sub-directory for attendance selfies
router.use((req, _res, next) => { req.uploadSubDir = 'attendance'; next(); });

router.post('/checkin',       upload.single('selfie'), ctrl.checkIn);
router.post('/checkout',      upload.single('selfie'), ctrl.checkOut);
router.post('/sync',          ctrl.syncOffline);
router.get ('/',              ctrl.listAttendance);
router.get ('/today-summary', authorize('ADMIN','HR'), ctrl.todaySummary);
router.get ('/daily-summary', ctrl.getDailySummary);

module.exports = router;
