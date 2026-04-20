const router = require('express').Router();
const ctrl   = require('../../controllers/adminController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate, authorize('ADMIN', 'HR'));

router.get ('/:officeId', ctrl.getPolicyByOffice);
router.post('/',          authorize('ADMIN'), ctrl.upsertPolicy);

module.exports = router;
