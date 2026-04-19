const router = require('express').Router();
const { login, register, changePassword, refreshToken, logout } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login',           login);
router.post('/register',        authenticate, authorize('ADMIN'), register);
router.post('/change-password', authenticate, changePassword);
router.post('/refresh',         refreshToken);
router.post('/logout',          authenticate, logout);

module.exports = router;
