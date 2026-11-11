const newsletterConfirmation = ({ unsubscribeUrl }) => {
  const subject = "You're subscribed to GoVolo updates 🎉";

  const text = [
    "Thanks for subscribing to GoVolo!",
    "",
    "You'll hear from us about new destinations, travel packages and product updates.",
    "",
    `If you didn't subscribe, you can unsubscribe here: ${unsubscribeUrl}`,
    "",
    "GoVolo",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:22px;margin:0 0 16px;">Thanks for subscribing to GoVolo!</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
    You'll hear from us about new destinations, travel packages and product updates.
  </p>
  <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px;">
    If you didn't subscribe, you can <a href="${unsubscribeUrl}" style="color:#0da5e7;">unsubscribe here</a>.
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;" />
  <p style="font-size:12px;color:#64748b;margin:0;">
    GoVolo &middot; <a href="${unsubscribeUrl}" style="color:#64748b;">Unsubscribe</a>
  </p>
</div>`;

  return { subject, text, html };
};

module.exports = newsletterConfirmation;
