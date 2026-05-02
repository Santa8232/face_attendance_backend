const router = require('express').Router();
const ctrl      = require('../../controllers/enrollmentController');
const faceVCtrl = require('../../controllers/faceVerificationController');
const { authenticate, authorize } = require('../../middleware/auth');
const upload    = require('../../middleware/upload');

router.use(authenticate);
router.use((req, _res, next) => { req.uploadSubDir = 'enrollment'; next(); });

// Face verification
router.post('/verify',  upload.any(), faceVCtrl.verifyFace);

// Enrollment
router.post('/enrollment/start',                    ctrl.startEnrollment);
router.post('/enrollment/upload/embeded',   upload.any(), ctrl.uploadEmbedded);
router.post('/enrollment/complete',                 ctrl.completeEnrollment);
router.post('/enrollment/:id/approve',          authorize('ADMIN', 'HR'), ctrl.approveTemplate);
router.post('/enrollment/:employee_id/reset',       authorize('ADMIN'),       ctrl.resetEnrollment);
router.get ('/enrollment/:employee_id/status',      ctrl.enrollmentStatus);

module.exports = router;
