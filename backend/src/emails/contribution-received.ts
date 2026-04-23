export function contributionReceivedEmail(params: {
  creatorName: string;
  supporterAddress: string;
  amount: string;
  assetCode: string;
  message?: string;
}): { subject: string; text: string; html: string } {
  const { creatorName, supporterAddress, amount, assetCode, message } = params;

  const subject = `${supporterAddress} sent you a contribution of ${amount} ${assetCode}`;

  const messageSection = message ? `\nTheir message: "${message}"\n` : "";

  const text = [
    `Hi ${creatorName},`,
    "",
    `You received a contribution of ${amount} ${assetCode} from ${supporterAddress}.`,
    messageSection,
    "Log in to NovaSupport to view your dashboard.",
    "",
    "— The NovaSupport Team",
  ].join("\n");

  const messageHtml = message
    ? `<p><em>Their message:</em> &ldquo;${message}&rdquo;</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:1.25rem">New contribution received</h1>
  <p>Hi <strong>${creatorName}</strong>,</p>
  <p>You received a contribution of <strong>${amount} ${assetCode}</strong> from <strong>${supporterAddress}</strong>.</p>
  ${messageHtml}
  <p>Log in to NovaSupport to view your dashboard.</p>
  <p style="color:#666;font-size:0.875rem">— The NovaSupport Team</p>
</body>
</html>`;

  return { subject, text, html };
}
