/**
 * Email templates for notification emails.
 *
 * Simple branded HTML emails with action links.
 * Each function returns { subject, html }.
 */

const APP_URL = Deno.env.get('APP_URL') ?? 'https://glossboss.ink';

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e9ecef; }
    .logo { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 24px; }
    .message { font-size: 15px; color: #333; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 10px 24px; background: #228be6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .footer { margin-top: 24px; font-size: 12px; color: #868e96; text-align: center; }
    .footer a { color: #868e96; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">GlossBoss</div>
      ${body}
    </div>
    <div class="footer">
      <p>You received this because you have email notifications enabled on <a href="${APP_URL}">GlossBoss</a>.</p>
      <p><a href="${APP_URL}/settings?tab=notifications">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>`;
}

function actionButton(href: string, label: string): string {
  return `<a href="${href}" class="btn">${label}</a>`;
}

// ── Template functions ─────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function orgInviteReceivedEmail(data: {
  organization_name: string;
  inviter_name: string;
  invite_token: string;
  role: string;
}): EmailTemplate {
  return {
    subject: `You've been invited to ${data.organization_name} on GlossBoss`,
    html: layout(`
      <p class="message">
        <strong>${esc(data.inviter_name)}</strong> invited you to join
        <strong>${esc(data.organization_name)}</strong> as a ${esc(data.role)}.
      </p>
      ${actionButton(`${APP_URL}/invite/${data.invite_token}`, 'Accept invite')}
    `),
  };
}

export function orgInviteAcceptedEmail(data: {
  organization_name: string;
  accepter_name: string;
}): EmailTemplate {
  return {
    subject: `${data.accepter_name} joined ${data.organization_name}`,
    html: layout(`
      <p class="message">
        <strong>${esc(data.accepter_name)}</strong> accepted your invite and
        joined <strong>${esc(data.organization_name)}</strong>.
      </p>
      ${actionButton(`${APP_URL}/dashboard`, 'Go to dashboard')}
    `),
  };
}

export function projectInviteReceivedEmail(data: {
  project_name: string;
  inviter_name: string;
  invite_token: string;
  role: string;
}): EmailTemplate {
  return {
    subject: `You've been invited to ${data.project_name} on GlossBoss`,
    html: layout(`
      <p class="message">
        <strong>${esc(data.inviter_name)}</strong> invited you to join
        <strong>${esc(data.project_name)}</strong> as a ${esc(data.role)}.
      </p>
      ${actionButton(`${APP_URL}/invite/project/${data.invite_token}`, 'Accept invite')}
    `),
  };
}

export function projectInviteAcceptedEmail(data: {
  project_name: string;
  accepter_name: string;
  project_id: string;
}): EmailTemplate {
  return {
    subject: `${data.accepter_name} joined ${data.project_name}`,
    html: layout(`
      <p class="message">
        <strong>${esc(data.accepter_name)}</strong> accepted your invite and
        joined <strong>${esc(data.project_name)}</strong>.
      </p>
      ${actionButton(`${APP_URL}/projects/${data.project_id}`, 'View project')}
    `),
  };
}

export function projectMemberAddedEmail(data: {
  project_name: string;
  project_id: string;
  role: string;
}): EmailTemplate {
  return {
    subject: `You've been added to ${data.project_name} on GlossBoss`,
    html: layout(`
      <p class="message">
        You've been added to <strong>${esc(data.project_name)}</strong> as a ${esc(data.role)}.
      </p>
      ${actionButton(`${APP_URL}/projects/${data.project_id}`, 'View project')}
    `),
  };
}

export function orgMemberAddedEmail(data: {
  organization_name: string;
  organization_slug: string;
  role: string;
}): EmailTemplate {
  return {
    subject: `You've been added to ${data.organization_name} on GlossBoss`,
    html: layout(`
      <p class="message">
        You've been added to <strong>${esc(data.organization_name)}</strong> as a ${esc(data.role)}.
      </p>
      ${actionButton(`${APP_URL}/orgs/${data.organization_slug}`, 'View organization')}
    `),
  };
}

export function reviewStatusChangedEmail(data: {
  project_name: string;
  project_id: string;
  language_id: string;
  msgid: string;
  new_status: string;
}): EmailTemplate {
  const preview = data.msgid.length > 60 ? data.msgid.slice(0, 60) + '...' : data.msgid;
  return {
    subject: `Review status changed in ${data.project_name}`,
    html: layout(`
      <p class="message">
        The review status of "<em>${esc(preview)}</em>" in
        <strong>${esc(data.project_name)}</strong> was changed to
        <strong>${esc(data.new_status)}</strong>.
      </p>
      ${actionButton(`${APP_URL}/projects/${data.project_id}/languages/${data.language_id}`, 'View entry')}
    `),
  };
}

export function reviewCommentAddedEmail(data: {
  project_name: string;
  project_id: string;
  language_id: string;
  msgid: string;
  comment_author: string;
}): EmailTemplate {
  const preview = data.msgid.length > 60 ? data.msgid.slice(0, 60) + '...' : data.msgid;
  return {
    subject: `New review comment in ${data.project_name}`,
    html: layout(`
      <p class="message">
        <strong>${esc(data.comment_author)}</strong> commented on
        "<em>${esc(preview)}</em>" in <strong>${esc(data.project_name)}</strong>.
      </p>
      ${actionButton(`${APP_URL}/projects/${data.project_id}/languages/${data.language_id}`, 'View comment')}
    `),
  };
}

export function stringsUpdatedEmail(data: {
  project_name: string;
  project_id: string;
  language_id: string;
  locale: string;
  update_count: number;
}): EmailTemplate {
  return {
    subject: `${data.update_count} strings updated in ${data.project_name} (${data.locale})`,
    html: layout(`
      <p class="message">
        <strong>${data.update_count}</strong> strings were updated in
        <strong>${esc(data.project_name)}</strong> (${esc(data.locale)}).
      </p>
      ${actionButton(`${APP_URL}/projects/${data.project_id}/languages/${data.language_id}`, 'View changes')}
    `),
  };
}

/**
 * Build an email template from a notification type and its data payload.
 */
export function buildEmailTemplate(
  type: string,
  data: Record<string, unknown>,
): EmailTemplate | null {
  switch (type) {
    case 'org_invite_received':
      return orgInviteReceivedEmail(data as Parameters<typeof orgInviteReceivedEmail>[0]);
    case 'org_invite_accepted':
      return orgInviteAcceptedEmail(data as Parameters<typeof orgInviteAcceptedEmail>[0]);
    case 'project_invite_received':
      return projectInviteReceivedEmail(data as Parameters<typeof projectInviteReceivedEmail>[0]);
    case 'project_invite_accepted':
      return projectInviteAcceptedEmail(data as Parameters<typeof projectInviteAcceptedEmail>[0]);
    case 'project_member_added':
      return projectMemberAddedEmail(data as Parameters<typeof projectMemberAddedEmail>[0]);
    case 'org_member_added':
      return orgMemberAddedEmail(data as Parameters<typeof orgMemberAddedEmail>[0]);
    case 'review_status_changed':
      return reviewStatusChangedEmail(data as Parameters<typeof reviewStatusChangedEmail>[0]);
    case 'review_comment_added':
      return reviewCommentAddedEmail(data as Parameters<typeof reviewCommentAddedEmail>[0]);
    case 'strings_updated':
      return stringsUpdatedEmail(data as Parameters<typeof stringsUpdatedEmail>[0]);
    default:
      return null;
  }
}

/** Escape HTML entities. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
