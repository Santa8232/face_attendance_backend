const router = require('express').Router();
const ctrl   = require('../../controllers/v1/authController');
const { authenticate } = require('../../middleware/auth');

router.post('/login',       ctrl.login);
router.post('/refresh',     ctrl.refreshToken);
router.post('/logout',      authenticate, ctrl.logout);
router.post('/request-otp', ctrl.requestOtp);
router.post('/verify-otp',  ctrl.verifyOtp);

module.exports = router;
