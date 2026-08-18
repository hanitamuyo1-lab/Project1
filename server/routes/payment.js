const express = require('express');
const { startCheckout, verifyPayment } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-checkout-session', startCheckout);
router.get('/verify-payment', verifyPayment);

module.exports = router;
