const router = require('express').Router();
const ctrl   = require('../../controllers/adminController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.post('/',                ctrl.raiseException);
router.get ('/',                ctrl.listExceptions);
router.post('/:id/review',      authorize('ADMIN','HR'), ctrl.reviewException);

module.exports = router;
