import { Resend } from "resend";
import { env } from "../config/env";
import { prisma } from "../config/database";

const FROM = "UChicago E-mart <noreply@uchicagoemart.com>";
const APP_URL = "https://uchicagoemart.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

// ── Shared layout ──────────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#800000;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">UChicago E-mart</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
              This is an automated message from UChicago E-mart. Please do not reply to this email.<br/>
              <a href="${APP_URL}" style="color:#800000;text-decoration:none;">Visit UChicago E-mart</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#800000;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${text}</a>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111;">${text}</h2>`;
}

function body(text: string): string {
  return `<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">${text}</p>`;
}

// ── Templates ──────────────────────────────────────────────────────────────

function messageTemplate(notifBody: string, link: string) {
  return {
    subject: "New message on UChicago E-mart",
    html: layout(`
      ${heading("You have a new message")}
      ${body(escapeHtml(notifBody))}
      ${button("View Message", `${APP_URL}${link}`)}
    `),
  };
}

function reviewTemplate(notifBody: string, link: string) {
  return {
    subject: "You received a new review",
    html: layout(`
      ${heading("You have a new review")}
      ${body(escapeHtml(notifBody))}
      ${button("View Review", `${APP_URL}${link}`)}
    `),
  };
}

function matchTemplate(title: string, notifBody: string, link: string) {
  return {
    subject: escapeHtml(title),
    html: layout(`
      ${heading(escapeHtml(title))}
      ${body(escapeHtml(notifBody))}
      ${button("View Transaction", `${APP_URL}${link}`)}
    `),
  };
}

function expiringTemplate(notifBody: string, link: string) {
  return {
    subject: "Your post is expiring soon",
    html: layout(`
      ${heading("Post expiring soon")}
      ${body(escapeHtml(notifBody))}
      ${button("Renew Post", `${APP_URL}${link}`)}
    `),
  };
}

function systemTemplate(title: string, notifBody: string, link: string | null) {
  return {
    subject: escapeHtml(title),
    html: layout(`
      ${heading(escapeHtml(title))}
      ${body(escapeHtml(notifBody))}
      ${link ? button("View Details", `${APP_URL}${link}`) : ""}
    `),
  };
}

// ── Main send function ─────────────────────────────────────────────────────

type NotificationType = "message" | "review" | "save" | "match" | "expiring" | "system";

export async function sendNotificationEmail(
  userId: string,
  type: NotificationType,
  title: string,
  notifBody: string,
  link: string | null | undefined
) {
  if (type === "save") return; // no email for saves

  const client = getResend();
  if (!client) return; // email disabled

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return;

  // For messages: only email on the first unread message per conversation.
  // The notification was already written to DB before this runs, so count >= 1.
  // If count > 1, there was already a prior unread — skip to avoid spamming.
  if (type === "message" && link) {
    const unreadCount = await prisma.notification.count({
      where: { userId, type: "message", link, isRead: false },
    });
    if (unreadCount > 1) return;
  }

  const dest = link ?? "/";
  let template: { subject: string; html: string };

  switch (type) {
    case "message":
      template = messageTemplate(notifBody, dest);
      break;
    case "review":
      template = reviewTemplate(notifBody, dest);
      break;
    case "match":
      template = matchTemplate(title, notifBody, dest);
      break;
    case "expiring":
      template = expiringTemplate(notifBody, dest);
      break;
    case "system":
      template = systemTemplate(title, notifBody, link ?? null);
      break;
    default:
      return;
  }

  await client.emails.send({
    from: FROM,
    to: user.email,
    subject: template.subject,
    html: template.html,
  });
}
