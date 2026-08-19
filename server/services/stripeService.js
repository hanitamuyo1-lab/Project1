const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_PENCE = parseInt(process.env.UNLOCK_PRICE_PENCE || '399', 10);
const APP_URL = (process.env.APP_URL || 'http://localhost:5500').replace(/\/$/, '');

function requireStripe() {
  if (!stripe) throw new Error('Stripe is not configured on the server (missing STRIPE_SECRET_KEY).');
}

async function createCheckoutSession() {
  requireStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: PRICE_PENCE,
          product_data: { name: 'Signal Triage — Live Mailbox Unlock' },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      statement_descriptor: 'SIGNAL TRIAGE',
    },
    success_url: `${APP_URL}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/#triage-section`,
  });
  return session.url;
}

async function verifyCheckoutSession(sessionId) {
  requireStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.payment_status === 'paid';
}

module.exports = { createCheckoutSession, verifyCheckoutSession };
