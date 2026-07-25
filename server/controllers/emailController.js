const { fetchLatestEmails, ImapError } = require('../services/imapService');
const { prioritizeEmails } = require('../services/aiService');

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or app password.',
  CONNECTION_FAILED: 'Could not connect to the mail server.',
  MAILBOX_LOCK_ERROR: 'Could not open the inbox — try again in a moment.',
  // UNSUPPORTED_PROVIDER has no fixed message here — err.message already carries
  // the specific "unsupported provider" text from imapService.
};

async function connectEmail(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password (app password) are required.' });
  }

  let emails;
  try {
    emails = await fetchLatestEmails(email, password, 20);
  } catch (err) {
    if (err instanceof ImapError) {
      const status = err.code === 'INVALID_CREDENTIALS' ? 401 : err.code === 'UNSUPPORTED_PROVIDER' ? 400 : 502;
      return res.status(status).json({ error: ERROR_MESSAGES[err.code] || err.message || 'Could not connect.', code: err.code });
    }
    console.error('Unexpected IMAP error:', err);
    return res.status(500).json({ error: 'Unexpected error fetching mailbox.' });
  }

  const scored = await prioritizeEmails(emails);
  const byId = new Map(scored.map((s) => [String(s.id), s]));

  const results = emails.map((e) => ({
    ...e,
    ...byId.get(String(e.id)),
  }));

  res.json({ success: true, emails: results });
}

module.exports = { connectEmail };
