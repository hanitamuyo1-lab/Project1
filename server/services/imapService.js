const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

// Known IMAP hosts per provider. Extend this map to support more providers later.
const PROVIDER_CONFIGS = [
  { match: /gmail\.com$/i, host: 'imap.gmail.com', port: 993 },
  { match: /outlook\.com$|hotmail\.com$|live\.com$/i, host: 'outlook.office365.com', port: 993 },
  { match: /yahoo\.com$/i, host: 'imap.mail.yahoo.com', port: 993 },
];

function getImapConfig(email) {
  const domainMatch = PROVIDER_CONFIGS.find((p) => p.match.test(email));
  if (!domainMatch) {
    throw new Error(`Unsupported email provider for "${email}". Only Gmail, Outlook and Yahoo are supported right now.`);
  }
  return { host: domainMatch.host, port: domainMatch.port, secure: true };
}

function buildPreview(text, maxLength = 240) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

// Connects via IMAP, fetches the most recent `limit` messages from INBOX,
// and returns plain-object summaries. Never persists the password anywhere.
async function fetchLatestEmails(email, password, limit = 20) {
  let host, port, secure;
  try {
    ({ host, port, secure } = getImapConfig(email));
  } catch (err) {
    throw new ImapError('UNSUPPORTED_PROVIDER', err);
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user: email, pass: password },
    logger: false,
  });

  const results = [];

  try {
    await client.connect();
  } catch (err) {
    const authFailure = err.authenticationFailed
      || /auth|credential|invalid|login/i.test(`${err.message || ''} ${err.responseText || ''}`);
    throw new ImapError(authFailure ? 'INVALID_CREDENTIALS' : 'CONNECTION_FAILED', err);
  }

  let lock;
  try {
    lock = await client.getMailboxLock('INBOX');
  } catch (err) {
    await client.logout().catch(() => {});
    throw new ImapError('MAILBOX_LOCK_ERROR', err);
  }

  try {
    const exists = client.mailbox.exists;
    if (exists > 0) {
      const start = Math.max(1, exists - limit + 1);
      const range = `${start}:*`;

      for await (const message of client.fetch(range, { envelope: true, source: true })) {
        let preview = '';
        try {
          const parsed = await simpleParser(message.source);
          preview = buildPreview(parsed.text || parsed.html || '');
        } catch {
          // If parsing the body fails, still return the envelope metadata.
        }

        results.push({
          id: message.uid,
          subject: message.envelope?.subject || '(no subject)',
          from: message.envelope?.from?.[0]
            ? `${message.envelope.from[0].name || ''} <${message.envelope.from[0].address}>`.trim()
            : 'Unknown sender',
          date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : null,
          preview,
        });
      }
    }
  } finally {
    lock.release();
  }

  await client.logout().catch(() => {});

  // Most recent first
  return results.sort((a, b) => new Date(b.date) - new Date(a.date));
}

class ImapError extends Error {
  constructor(code, cause) {
    super(cause?.message || code);
    this.code = code;
    this.cause = cause;
  }
}

module.exports = { fetchLatestEmails, getImapConfig, ImapError };
