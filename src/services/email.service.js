require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

/**
 * Send an email through the shared Gmail OAuth2 transporter.
 *
 * Errors are caught and logged, never thrown — callers cannot detect a
 * failed send.
 *
 * @param {string} to Recipient address.
 * @param {string} subject Subject line.
 * @param {string} text Plaintext body, used as the fallback.
 * @param {string} html HTML body.
 * @returns {Promise<void>}
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Backened Ledger" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

/**
 * Send the branded welcome email after a successful registration.
 *
 * @param {string} userEmail Recipient address.
 * @param {string} name Display name interpolated into the greeting.
 * @returns {Promise<void>}
 */
async function sendRegistrationEmail(userEmail, name) {
  const subject = "Welcome to Backend Ledger!";
  
  const text = `Welcome to Backend Ledger, ${name}!

Hi ${name},

Thank you for signing up for Backend Ledger. We're excited to have you on board!

With Backend Ledger, you can effortlessly track financial transactions, manage double-entry account ledgers, and keep your business records secure and audit-ready.

Here are a few steps to get started:
1. Set up your primary ledger accounts
2. Record your initial opening balances
3. Explore API endpoints for automated transaction logging

If you have any questions or need help setting up, feel free to reply to this email or contact our support team.

Best regards,
The Backend Ledger Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Backend Ledger</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Backend Ledger</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600;">Welcome aboard, ${name}! 👋</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Thank you for joining <strong>Backend Ledger</strong>. We're thrilled to help you manage your financial records, track accounts, and maintain audit-ready transaction ledgers with ease.
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 28px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b; font-size: 14px;">Quick steps to get started:</p>
                <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
                  <li>Set up your primary ledger accounts</li>
                  <li>Record your initial opening balances</li>
                  <li>Explore API endpoints for automated transaction logging</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="https://your-app-domain.com/dashboard" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Go to Dashboard</a>
                  </td>
                </tr>
              </table>

              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
                If you have any questions or need assistance getting set up, simply reply to this email—our support team is always here to help.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Backend Ledger. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(userEmail, subject, text, html);
}

/** Badge colours per transaction status, keyed to the `transaction` schema enum. */
const STATUS_STYLES = {
  COMPLETED: { bg: "#dcfce7", fg: "#166534", label: "Completed" },
  PENDING: { bg: "#fef3c7", fg: "#92400e", label: "Pending" },
  FAILED: { bg: "#fee2e2", fg: "#991b1b", label: "Failed" },
  REVERSED: { bg: "#e2e8f0", fg: "#475569", label: "Reversed" },
};

/**
 * Shorten a Mongo ObjectId for display, keeping the tail recognisable.
 *
 * @param {unknown} id
 * @returns {string} e.g. `••••4f9c2a`
 */
function maskId(id) {
  const str = String(id ?? "");
  return str.length > 6 ? `••••${str.slice(-6)}` : str;
}

/**
 * Format a money amount for display, tolerating unknown currency codes.
 *
 * `Intl.NumberFormat` throws a `RangeError` on an invalid ISO code, which
 * would otherwise take down the request that triggered the email.
 *
 * @param {number} amount
 * @param {string} currency ISO 4217 code.
 * @returns {string} e.g. `₹12,500.50`, or `XYZ 42.00` when unrecognised.
 */
function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * @param {Date|string|number} date
 * @returns {string} e.g. `18 Aug 2026, 4:02 pm`
 */
function formatTimestamp(date) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Send a transaction receipt for a completed or attempted transfer.
 *
 * @param {string} userEmail Recipient address.
 * @param {string} name Display name for the greeting.
 * @param {number} amount Transfer amount, in major units.
 * @param {string} toAccount Destination account id.
 * @param {object} [details] Optional extras pulled from the transaction doc.
 * @param {string} [details.transactionId] `_id` of the transaction.
 * @param {string} [details.fromAccount] Source account id.
 * @param {"COMPLETED"|"PENDING"|"FAILED"|"REVERSED"} [details.status] Defaults to `COMPLETED`.
 * @param {string} [details.currency] ISO code, defaults to `INR`.
 * @param {Date} [details.createdAt] Defaults to now.
 * @returns {Promise<void>}
 */
async function sendTransactionEmail(userEmail, name, amount, toAccount, details = {}) {
  const {
    transactionId,
    fromAccount,
    status = "COMPLETED",
    currency = "INR",
    createdAt = new Date(),
  } = details;

  const badge = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  const formattedAmount = formatAmount(amount, currency);
  const timestamp = formatTimestamp(createdAt);

  const subject = `${badge.label}: ${formattedAmount} to ${maskId(toAccount)}`;

  const text = `Transaction ${badge.label} — Backend Ledger

Hi ${name},

Amount:       ${formattedAmount}
Status:       ${badge.label}
To account:   ${maskId(toAccount)}
${fromAccount ? `From account: ${maskId(fromAccount)}\n` : ""}${transactionId ? `Reference:    ${transactionId}\n` : ""}Date:         ${timestamp}

If you did not authorise this transaction, contact our support team immediately.

Best regards,
The Backend Ledger Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction ${badge.label}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Backend Ledger</h1>
            </td>
          </tr>
          <!-- Amount hero -->
          <tr>
            <td style="padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Transaction Receipt</p>
              <p style="margin: 0 0 14px 0; color: #0f172a; font-size: 36px; font-weight: 700; letter-spacing: -1px;">${formattedAmount}</p>
              <span style="display: inline-block; background-color: ${badge.bg}; color: ${badge.fg}; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 999px;">${badge.label}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi ${name}, here are the details of your recent transaction.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
                <tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">To account</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${maskId(toAccount)}</td>
                </tr>
                ${
                  fromAccount
                    ? `<tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">From account</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${maskId(fromAccount)}</td>
                </tr>`
                    : ""
                }
                ${
                  transactionId
                    ? `<tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Reference</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${transactionId}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding: 12px 0; color: #64748b;">Date</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right;">${timestamp}</td>
                </tr>
              </table>

              <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-top: 28px;">
                <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
                  Didn't authorise this? <strong style="color: #1e293b;">Contact support immediately</strong> — reply to this email and we'll freeze the account while we investigate.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Backend Ledger. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(userEmail, subject, text, html);
}

/**
 * Notify the sender that a transfer did not go through.
 *
 * Deliberately shaped as an alert rather than a receipt: it leads with the
 * failure reason and an explicit "no funds were debited" reassurance, since
 * the most common support ticket after a failed transfer is "where is my
 * money".
 *
 * @param {string} userEmail Recipient address.
 * @param {string} name Display name for the greeting.
 * @param {number} amount Attempted amount, in major units.
 * @param {string} toAccount Intended destination account id.
 * @param {object} [details]
 * @param {string} [details.reason] Human-readable cause, e.g. "Insufficient balance".
 * @param {string} [details.transactionId] `_id` of the failed transaction.
 * @param {string} [details.fromAccount] Source account id.
 * @param {string} [details.currency] ISO code, defaults to `INR`.
 * @param {Date} [details.createdAt] Defaults to now.
 * @param {boolean} [details.debited] Set `true` when funds left the account and
 *   a reversal is pending — changes the reassurance copy. Defaults to `false`.
 * @returns {Promise<void>}
 */
async function sendTransactionFailureEmail(
  userEmail,
  name,
  amount,
  toAccount,
  details = {},
) {
  const {
    reason = "The transaction could not be completed.",
    transactionId,
    fromAccount,
    currency = "INR",
    createdAt = new Date(),
    debited = false,
  } = details;

  const formattedAmount = formatAmount(amount, currency);
  const timestamp = formatTimestamp(createdAt);

  const reassurance = debited
    ? "The amount was debited and a reversal is in progress. It will be back in your account within 3–5 business days."
    : "No funds were debited from your account.";

  const subject = `Transaction failed: ${formattedAmount} to ${maskId(toAccount)}`;

  const text = `Transaction Failed — Backend Ledger

Hi ${name},

We could not complete your transfer of ${formattedAmount} to ${maskId(toAccount)}.

Reason:       ${reason}
${reassurance}

Amount:       ${formattedAmount}
To account:   ${maskId(toAccount)}
${fromAccount ? `From account: ${maskId(fromAccount)}\n` : ""}${transactionId ? `Reference:    ${transactionId}\n` : ""}Attempted:    ${timestamp}

You can retry the transfer at any time. If this keeps happening, reply to this
email with the reference above and our support team will investigate.

Best regards,
The Backend Ledger Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Failed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Backend Ledger</h1>
            </td>
          </tr>
          <!-- Alert strip -->
          <tr>
            <td style="background-color: #dc2626; padding: 14px 40px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">Transaction Failed</p>
            </td>
          </tr>
          <!-- Amount hero -->
          <tr>
            <td style="padding: 36px 40px 28px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Amount not transferred</p>
              <p style="margin: 0; color: #94a3b8; font-size: 36px; font-weight: 700; letter-spacing: -1px; text-decoration: line-through;">${formattedAmount}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi ${name}, we weren't able to complete your transfer to <strong style="color: #0f172a;">${maskId(toAccount)}</strong>.
              </p>

              <!-- Reason -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #991b1b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
                <p style="margin: 0; color: #7f1d1d; font-size: 15px; line-height: 1.5;">${reason}</p>
              </div>

              <!-- Reassurance -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 28px;">
                <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">${reassurance}</p>
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
                <tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">To account</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${maskId(toAccount)}</td>
                </tr>
                ${
                  fromAccount
                    ? `<tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">From account</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${maskId(fromAccount)}</td>
                </tr>`
                    : ""
                }
                ${
                  transactionId
                    ? `<tr>
                  <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Reference</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', Menlo, Consolas, monospace;">${transactionId}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding: 12px 0; color: #64748b;">Attempted</td>
                  <td style="padding: 12px 0; color: #0f172a; font-weight: 600; text-align: right;">${timestamp}</td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="https://your-app-domain.com/transfers/new" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Try again</a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                Still stuck? Reply to this email with the reference above and our support team will take a look.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Backend Ledger. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(userEmail, subject, text, html);
}

module.exports = {
  sendEmail,
  sendRegistrationEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail,
  transporter,
};

