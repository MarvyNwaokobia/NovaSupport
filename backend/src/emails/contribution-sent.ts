export function contributionSentEmail(params: {
  recipientName: string;
  amount: string;
  assetCode: string;
  txHash: string;
}): { subject: string; text: string; html: string } {
  const { recipientName, amount, assetCode, txHash } = params;

  const subject = `Your contribution of ${amount} ${assetCode} to ${recipientName} was sent`;

  const text = [
    `Your contribution was delivered!`,
    "",
    `You sent ${amount} ${assetCode} to ${recipientName}.`,
    "",
    `Transaction hash: ${txHash}`,
    "",
    "Thank you for supporting creators on NovaSupport.",
    "",
    "— The NovaSupport Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:1.25rem">Contribution sent</h1>
  <p>Your contribution was delivered!</p>
  <p>You sent <strong>${amount} ${assetCode}</strong> to <strong>${recipientName}</strong>.</p>
  <p style="font-size:0.875rem;color:#666">Transaction hash: <code>${txHash}</code></p>
  <p>Thank you for supporting creators on NovaSupport.</p>
  <p style="color:#666;font-size:0.875rem">— The NovaSupport Team</p>
</body>
</html>`;

  return { subject, text, html };
}
