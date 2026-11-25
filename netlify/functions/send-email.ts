import nodemailer from 'nodemailer';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  try {
    const rawBody = event.body ? JSON.parse(event.body) : {};
    const params = rawBody.template_params || rawBody;

    const toEmail = params.to_email || params.email || params.recipient || params.to || params.user_email;
    const toName = params.to_name || params.recipient_name || params.name || 'Citizen';
    const subject = params.subject || 'CityZen Notification';
    const htmlBody = params.html_message || params.html_content || params.message_html || params.body_html || '';
    const textBody = params.message || params.message_body || params.content || params.body || '';

    if (!toEmail || !toEmail.includes('@')) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: 'Valid recipient email address is required.' }),
      };
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER || 'cityzen.system@gmail.com';
    const rawPass = process.env.SMTP_PASS || process.env.VITE_SMTP_PASS || '';
    const smtpPass = rawPass.replace(/\s+/g, '');
    const senderName = process.env.SMTP_SENDER_NAME || 'CityZen';

    if (!smtpPass) {
      console.warn('SMTP_PASS environment variable is not configured.');
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: 'SMTP_PASS environment variable is not configured on the server.',
        }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${senderName}" <${smtpUser}>`,
      to: toName && toName !== 'Citizen' ? `"${toName}" <${toEmail}>` : toEmail,
      subject,
      text: textBody,
      html: htmlBody || textBody.replace(/\n/g, '<br/>'),
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: `Email delivered to ${toEmail} via Gmail SMTP`,
      }),
    };
  } catch (error: any) {
    console.error('SMTP relay error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to dispatch email via SMTP',
      }),
    };
  }
};
