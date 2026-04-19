const router = require('express').Router();
const ctrl   = require('../../controllers/v1/exceptionsController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.post('/',                           ctrl.raiseException);
router.get ('/',                           ctrl.listExceptions);
router.post('/:exception_id/review',      authorize('ADMIN','HR'), ctrl.reviewException);

module.exports = router;
