const router = require('express').Router();
const ctrl   = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

// Set upload sub-directory for enrollment images
router.use((req, _res, next) => { req.uploadSubDir = 'enrollment'; next(); });

router.get ('/:id/status',      ctrl.enrollmentStatus);
router.post('/start',             ctrl.startEnrollment);
router.post('/upload/embeded',    upload.any(), ctrl.uploadEmbedded);
router.post('/complete',          ctrl.completeEnrollment);
router.post('/:id/reset',         authorize('ADMIN'), ctrl.resetEnrollment);

module.exports = router;
