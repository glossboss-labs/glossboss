/**
 * Resend email helper — shared across edge functions.
 *
 * Sends transactional emails via the Resend HTTP API.
 * Rate-limits to avoid hitting Resend quotas.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'GlossBoss <notifications@glossboss.ink>';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a single email via Resend.
 * Throws on HTTP errors.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

/**
 * Send a batch of emails with rate limiting.
 * Processes up to `batchSize` emails, pausing between batches.
 */
export async function sendEmailBatch(
  emails: EmailPayload[],
  batchSize = 10,
  delayMs = 1000,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((e) => sendEmail(e)));

    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else {
        failed++;
        console.error('Email send failed:', r.reason);
      }
    }

    // Rate limit pause between batches (skip after last batch)
    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed };
}
