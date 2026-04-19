const router = require('express').Router();
const ctrl   = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

// Set upload sub-directory for enrollment images
router.use((req, _res, next) => { req.uploadSubDir = 'enrollment'; next(); });

router.post('/:employeeId/status',  ctrl.enrollmentStatus);           // GET semantically but POST to avoid URL conflicts
router.get ('/:employeeId/status',  ctrl.enrollmentStatus);
router.post('/start',               ctrl.startEnrollment);
router.post('/:sessionId/sample',   upload.single('image'), ctrl.uploadSample);
router.post('/:sessionId/complete', ctrl.completeEnrollment);
router.delete('/:employeeId/reset', authorize('ADMIN'), ctrl.resetEnrollment);

module.exports = router;
