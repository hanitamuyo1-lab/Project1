const { createCheckoutSession, verifyCheckoutSession } = require('../services/stripeService');

async function startCheckout(req, res) {
  try {
    const url = await createCheckoutSession();
    res.json({ url });
  } catch (err) {
    console.error('Stripe checkout session failed:', err.message);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
}

async function verifyPayment(req, res) {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id is required.' });

  try {
    const paid = await verifyCheckoutSession(session_id);
    res.json({ paid });
  } catch (err) {
    console.error('Stripe session verification failed:', err.message);
    res.status(500).json({ error: 'Could not verify payment.' });
  }
}

module.exports = { startCheckout, verifyPayment };
