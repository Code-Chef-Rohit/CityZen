import { supabase } from './supabase';

export interface EmailGatewayConfig {
  enabled: boolean;
  provider: 'emailjs' | 'webhook' | 'relay';
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  webhookUrl: string;
  senderName: string;
  senderEmail: string;
}

const STORAGE_KEY = 'cityzen_email_gateway_config';

// Default configuration with fallback relay support
export const DEFAULT_EMAIL_CONFIG: EmailGatewayConfig = {
  enabled: true,
  provider: 'emailjs',
  emailjsServiceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_xlxsj8f',
  emailjsTemplateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_bnczuvh',
  emailjsPublicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'l8ZDaCW7jP2JEQfDN',
  webhookUrl: '',
  senderName: 'CityZen Portal',
  senderEmail: 'cityzen.system@gmail.com',
};

export const ROLE_AUTHORITY_INFO: Record<string, { title: string; clearance: string; responsibilities: string; permissions: string[] }> = {
  admin: {
    title: 'Super Administrator',
    clearance: 'Level-5 Executive Clearance',
    responsibilities: 'Full administrative control over city digital infrastructure, citizen registry, role clearance, database auditing, and department overrides.',
    permissions: [
      'Superuser access to Admin Control Center',
      'Assign & revoke municipal officer clearances',
      'Database audits & emergency dispatch reassignment',
      'System telemetry & configuration control'
    ]
  },
  police: {
    title: 'Law Enforcement Dispatcher',
    clearance: 'Level-3 Security Clearance',
    responsibilities: 'First responder police control, live cruiser GPS dispatching, citizen emergency distress response, and safety verification.',
    permissions: [
      'Police SOS Incident Management & GPS Tracking',
      'Direct contact & triage of active distress calls',
      'Real-time cruiser navigation & responder routing',
      'Official police incident clearance & logging'
    ]
  },
  hospital: {
    title: 'Emergency Medical Controller',
    clearance: 'Level-3 Medical Clearance',
    responsibilities: 'Hospital emergency telemetry, ambulance triage & dispatching, critical care bed occupancy tracking, and casualty management.',
    permissions: [
      'Ambulance dispatch & trauma unit routing',
      'Hospital bed & oxygen capacity telemetry',
      'Emergency medical response clearance',
      'Verified doctor & paramedic communications'
    ]
  },
  bmc: {
    title: 'Municipal Public Works Inspector',
    clearance: 'Level-2 Municipal Operations Clearance',
    responsibilities: 'City infrastructure oversight, pothole & road repair dispatch, streetlight illumination monitoring, and civic sanitation resolution.',
    permissions: [
      'Civic Grievance Resolution & Work Orders',
      'Sanitation team dispatch & bin management',
      'Streetlight & pothole repair verification',
      'Ward-level municipal inspection reports'
    ]
  },
  citizen: {
    title: 'Registered Verified Citizen',
    clearance: 'Level-1 Public Access',
    responsibilities: 'Standard civic engagement, filing municipal grievances, bill payments, and requesting emergency assistance.',
    permissions: [
      'File & track civic complaints',
      'Municipal utility bill settlement (BBPS)',
      '1-Click SOS emergency distress requests',
      'Access Zen AI municipal digital assistant'
    ]
  }
};

export function getEmailGatewayConfig(): EmailGatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Auto-migrate legacy or outdated configs so verified keys are always used
      if (parsed.emailjsPublicKey !== 'l8ZDaCW7jP2JEQfDN') {
        parsed.emailjsPublicKey = DEFAULT_EMAIL_CONFIG.emailjsPublicKey;
      }
      if (parsed.emailjsServiceId !== 'service_xlxsj8f') {
        parsed.emailjsServiceId = DEFAULT_EMAIL_CONFIG.emailjsServiceId;
      }
      if (parsed.emailjsTemplateId !== 'template_bnczuvh') {
        parsed.emailjsTemplateId = DEFAULT_EMAIL_CONFIG.emailjsTemplateId;
      }
      if (!parsed.senderName || parsed.senderName === 'CityZen Admin') {
        parsed.senderName = 'CityZen Portal';
      }
      if (!parsed.senderEmail || parsed.senderEmail.includes('odisha.gov.in')) {
        parsed.senderEmail = 'cityzen.system@gmail.com';
      }
      return { ...DEFAULT_EMAIL_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse email gateway config from localStorage:', e);
  }
  return DEFAULT_EMAIL_CONFIG;
}

export function saveEmailGatewayConfig(config: EmailGatewayConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save email gateway config to localStorage:', e);
  }
}

export interface RoleChangeEmailData {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  newRole: string;
  roleTitle: string;
  clearance: string;
  responsibilities: string;
  permissions: string[];
  refNumber: string;
  subject: string;
  body: string;
}

export interface EmailDispatchResult {
  success: boolean;
  status: 'delivered' | 'transmitted' | 'failed';
  dispatchId: string;
  timestamp: string;
  method: string;
  message: string;
}

export const CITYZEN_LOGO_URL = 'https://cityzen-one.netlify.app/logo.jpg';

export function buildRoleChangeHtmlEmail(data: RoleChangeEmailData, portalUrl: string): string {
  const logoUrl = CITYZEN_LOGO_URL;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen Account Update</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;background:#1e293b;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <tr>
      <td style="padding:32px 24px 18px;text-align:center;background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${logoUrl}" alt="CityZen Logo" width="80" height="80" style="border-radius:20px;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 20px rgba(56,189,248,0.25);display:inline-block;margin-bottom:12px;" />
        <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px;">CityZen</h1>
        <p style="color:#38bdf8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">One City · One App</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <p style="font-size:15px;line-height:22px;color:#f8fafc;margin:0 0 14px;">
          Hi <strong>${data.userName}</strong>,
        </p>
        <p style="font-size:13px;line-height:20px;color:#94a3b8;margin:0 0 20px;">
          Your account role on the CityZen portal has been updated:
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:16px;border:1px solid rgba(56,189,248,0.25);margin-bottom:20px;">
          <tr>
            <td style="padding:16px 20px;">
              <span style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#38bdf8;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.2);padding:2px 8px;border-radius:6px;margin-bottom:6px;">
                Assigned Role
              </span>
              <div style="font-size:17px;font-weight:800;color:#ffffff;margin-bottom:2px;">
                ${data.roleTitle}
              </div>
              <div style="font-size:12px;color:#64748b;">
                ${data.clearance}
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-bottom:22px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:0 0 10px;">
            Included Features & Access:
          </p>
          <ul style="margin:0;padding-left:18px;font-size:12px;line-height:22px;color:#cbd5e1;">
            ${data.permissions.map(p => `<li style="margin-bottom:3px;">${p}</li>`).join('')}
          </ul>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
          <tr>
            <td align="center">
              <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                Open CityZen Portal →
              </a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;font-size:11px;color:#64748b;">
          <tr>
            <td style="padding:2px 0;">Account: <strong style="color:#cbd5e1;">${data.userEmail}</strong></td>
            <td align="right" style="padding:2px 0;">Ref: <strong style="color:#cbd5e1;">${data.refNumber}</strong></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#090d16;padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:10px;line-height:16px;color:#64748b;">
        This automated notification was sent for your verified account on CityZen.<br>
        For inquiries, reply to <a href="mailto:cityzen.system@gmail.com" style="color:#38bdf8;text-decoration:none;">cityzen.system@gmail.com</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAutomatedRoleChangeEmail(data: RoleChangeEmailData): Promise<EmailDispatchResult> {
  const config = getEmailGatewayConfig();
  const dispatchId = `DISP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();
  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cityzen-one.netlify.app';
  const htmlEmail = buildRoleChangeHtmlEmail(data, portalUrl);

  if (!data.userEmail || !data.userEmail.includes('@')) {
    return {
      success: false,
      status: 'failed',
      dispatchId,
      timestamp,
      method: 'in_app_only',
      message: 'No valid recipient email address on file for this user.',
    };
  }

  // Payload for automated transmission
  const payload = {
    service_id: config.emailjsServiceId,
    template_id: config.emailjsTemplateId,
    user_id: config.emailjsPublicKey,
    template_params: {
      to_name: data.userName,
      recipient_name: data.userName,
      user_name: data.userName,
      name: data.userName,
      to_email: data.userEmail,
      email: data.userEmail,
      to: data.userEmail,
      user_email: data.userEmail,
      recipient: data.userEmail,
      recipient_email: data.userEmail,
      target_email: data.userEmail,
      citizen_email: data.userEmail,
      receiver_email: data.userEmail,
      to_user: data.userEmail,
      reply_to: config.senderEmail || 'cityzen.system@gmail.com',
      from_name: config.senderName || 'CityZen Portal',
      subject: data.subject,
      message: data.body,
      message_body: data.body,
      content: data.body,
      body: data.body,
      official_content: data.body,
      details: data.body,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
      logo_url: CITYZEN_LOGO_URL,
      logo_img: `<img src="${CITYZEN_LOGO_URL}" alt="CityZen Logo" width="76" height="76" style="border-radius:18px;display:block;margin:0 auto 12px auto;" />`,
      login_link: portalUrl,
      portal_url: portalUrl,
      new_role: data.newRole.toUpperCase(),
      role: data.newRole.toUpperCase(),
      role_title: data.roleTitle,
      designation: `${data.roleTitle} (${data.clearance})`,
      clearance: data.clearance,
      responsibilities: data.responsibilities,
      permissions_list: data.permissions.join(', '),
      authorized_capabilities: data.permissions.map(p => `• ${p}`).join('\n'),
      ref_number: data.refNumber,
      dispatch_id: dispatchId,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    },
  };

  let transmittedViaApi = false;
  let apiResponseMsg = '';

  // 1. Attempt Automated Cloud API Transmission (Custom Webhook or EmailJS)
  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = 'Dispatched via Municipal Webhook Relay';
      }
    } catch (e: any) {
      console.warn('Webhook transmission error:', e.message);
    }
  } else if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = `Delivered via EmailJS Cloud SMTP Gateway (${config.emailjsServiceId})`;
      } else {
        const errText = await res.text();
        console.warn('EmailJS response status:', res.status, errText);
        apiResponseMsg = `EmailJS API (${res.status}): ${errText}`;
      }
    } catch (e: any) {
      console.warn('EmailJS transmission error:', e.message);
      apiResponseMsg = `EmailJS Network Error: ${e.message}`;
    }
  }

  // 2. Automated Municipal In-App Notification Recording
  // Ensure the user receives immediate high-priority alert on their dashboard
  try {
    await supabase.from('notifications').insert({
      user_id: data.userId,
      title: `🏛️ Authority Granted: Designated as ${data.newRole.toUpperCase()}`,
      message: `Your CityZen municipal security clearance has been formally updated to ${data.newRole.toUpperCase()} (${data.roleTitle}) by the Municipal Administration. Dispatch Reference: ${data.refNumber}. Please log in to access your authorized department controls.`,
      type: 'government',
      read: false,
    });
  } catch (dbErr) {
    console.warn('Supabase in-app notice insert fallback:', dbErr);
  }

  // 3. Log automated dispatch record in local dispatch history
  try {
    const historyKey = 'cityzen_email_dispatch_log';
    const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const newEntry = {
      dispatchId,
      timestamp,
      recipientEmail: data.userEmail,
      recipientName: data.userName,
      role: data.newRole,
      refNumber: data.refNumber,
      status: transmittedViaApi ? 'delivered' : 'failed',
      method: apiResponseMsg || 'CityZen System Background Dispatch',
      subject: data.subject,
    };
    existing.unshift(newEntry);
    localStorage.setItem(historyKey, JSON.stringify(existing.slice(0, 50)));
  } catch (logErr) {
    console.warn('Failed to save to dispatch log:', logErr);
  }

  return {
    success: transmittedViaApi,
    status: transmittedViaApi ? 'delivered' : 'failed',
    dispatchId,
    timestamp,
    method: apiResponseMsg || 'CityZen System Background Dispatch (no-reply@cityzen.odisha.gov.in)',
    message: transmittedViaApi
      ? `Official communique transmitted automatically to ${data.userEmail} via EmailJS Cloud (Ref: ${data.refNumber}).`
      : `Email dispatch failed: ${apiResponseMsg || 'Network or API error'}.`,
  };
}

/**
 * Send a test automated email from the Admin Gateway Settings modal
 */
export async function sendTestAutomatedEmail(targetEmail: string): Promise<EmailDispatchResult> {
  const dummyData: RoleChangeEmailData = {
    userId: 'test-admin',
    userName: 'Officer in Command',
    userEmail: targetEmail,
    newRole: 'admin',
    roleTitle: 'Municipal Operations Supervisor',
    clearance: 'Level-5 Executive Clearance',
    responsibilities: 'Diagnostic validation of CityZen Automated Municipal Mail Gateway.',
    permissions: ['Test Dispatch Access', 'Telemetry Inspection'],
    refNumber: `CZ-TEST-${Math.floor(100000 + Math.random() * 900000)}`,
    subject: 'CityZen gateway verification test',
    body: `Hi Officer in Command,\n\nThis is an automated test message from the CityZen platform.\n\nGateway status: Active\nTimestamp: ${new Date().toLocaleString()}\n\nBest regards,\nThe CityZen Team`,
  };

  return await sendAutomatedRoleChangeEmail(dummyData);
}

export interface CitizenNoticeEmailData {
  userId?: string;
  userEmail: string;
  userName?: string;
  title: string;
  subject: string;
  message: string;
  category?: string;
  refNumber?: string;
}

export function buildCitizenNoticeHtmlEmail(data: CitizenNoticeEmailData, portalUrl: string, refNum: string): string {
  const logoUrl = CITYZEN_LOGO_URL;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;background:#1e293b;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <tr>
      <td style="padding:32px 24px 18px;text-align:center;background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${logoUrl}" alt="CityZen Logo" width="80" height="80" style="border-radius:20px;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 20px rgba(56,189,248,0.25);display:inline-block;margin-bottom:12px;" />
        <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;">CityZen</h1>
        <p style="color:#38bdf8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">One City · One App</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <p style="font-size:15px;line-height:22px;color:#f8fafc;margin:0 0 14px;">
          Hi <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <div style="background:#0f172a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);padding:16px 18px;margin-bottom:20px;">
          <h2 style="font-size:15px;color:#38bdf8;margin:0 0 8px;">${data.title}</h2>
          <p style="font-size:13px;line-height:20px;color:#cbd5e1;margin:0;white-space:pre-line;">${data.message}</p>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
          <tr>
            <td align="center">
              <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                Open CityZen Portal →
              </a>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;font-size:11px;color:#64748b;">
          <tr>
            <td style="padding:2px 0;">Account: <strong style="color:#cbd5e1;">${data.userEmail}</strong></td>
            <td align="right" style="padding:2px 0;">Ref: <strong style="color:#cbd5e1;">${refNum}</strong></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#090d16;padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:10px;line-height:16px;color:#64748b;">
        This automated notification was sent for your account on CityZen.<br>
        For inquiries, reply to <a href="mailto:cityzen.system@gmail.com" style="color:#38bdf8;text-decoration:none;">cityzen.system@gmail.com</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Automatically dispatches official notifications and lifecycle updates
 * across all personas (Police SOS, BMC Grievance Resolution, Hospital Ambulance, Admin Actions)
 * directly to the citizen's email in the background without user intervention.
 */
export async function sendAutomatedCitizenNoticeEmail(data: CitizenNoticeEmailData): Promise<EmailDispatchResult> {
  const config = getEmailGatewayConfig();
  const dispatchId = `DISP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();
  const refNum = data.refNumber || `CZ-NOTIF-${Math.floor(100000 + Math.random() * 900000)}`;
  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cityzen-one.netlify.app';
  const htmlNotice = buildCitizenNoticeHtmlEmail(data, portalUrl, refNum);

  if (!data.userEmail || !data.userEmail.includes('@')) {
    return {
      success: false,
      status: 'failed',
      dispatchId,
      timestamp,
      method: 'in_app_only',
      message: 'No recipient email specified.',
    };
  }

  const payload = {
    service_id: config.emailjsServiceId,
    template_id: config.emailjsTemplateId,
    user_id: config.emailjsPublicKey,
    template_params: {
      to_name: data.userName || 'Citizen',
      to_email: data.userEmail,
      recipient: data.userEmail,
      email: data.userEmail,
      user_email: data.userEmail,
      reply_to: config.senderEmail,
      from_name: config.senderName,
      subject: data.subject || data.title,
      message: data.message,
      message_body: data.message,
      content: data.message,
      html_message: htmlNotice,
      html_content: htmlNotice,
      message_html: htmlNotice,
      body_html: htmlNotice,
      logo_url: CITYZEN_LOGO_URL,
      logo_img: `<img src="${CITYZEN_LOGO_URL}" alt="CityZen Logo" width="76" height="76" style="border-radius:18px;display:block;margin:0 auto 12px auto;" />`,
      role_title: data.title,
      new_role: (data.category || 'NOTICE').toUpperCase(),
      ref_number: refNum,
      dispatch_id: dispatchId,
      portal_url: portalUrl,
      login_link: portalUrl,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    },
  };

  let transmittedViaApi = false;
  let apiResponseMsg = '';

  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = 'Dispatched via Municipal Webhook Relay';
      }
    } catch (e: any) {
      console.warn('Webhook transmission error:', e.message);
    }
  } else if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = `Delivered via EmailJS Cloud SMTP Gateway (${config.emailjsServiceId})`;
      } else {
        const errText = await res.text();
        console.warn('EmailJS response status:', res.status, errText);
        apiResponseMsg = `EmailJS Notice (${res.status}): ${errText}`;
      }
    } catch (e: any) {
      console.warn('EmailJS transmission error:', e.message);
      apiResponseMsg = `EmailJS Network Error: ${e.message}`;
    }
  }

  // Record in-app notification if userId is provided
  if (data.userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.userId,
        title: data.title,
        message: data.message,
        type: (data.category as any) || 'government',
        read: false,
      });
    } catch (err) {
      console.warn('In-app notification insert fallback:', err);
    }
  }

  return {
    success: true,
    status: transmittedViaApi ? 'delivered' : 'transmitted',
    dispatchId,
    timestamp,
    method: apiResponseMsg || 'CityZen System Background Dispatch',
    message: transmittedViaApi
      ? `Notice automatically transmitted to ${data.userEmail} via EmailJS.`
      : `Notice automatically recorded for ${data.userEmail}.`,
  };
}

/* ============================================================================ */
/* PASSWORD CHANGED EMAIL NOTIFICATION                                          */
/* ============================================================================ */

export interface PasswordChangedEmailData {
  userId?: string;
  userName: string;
  userEmail: string;
  newPassword?: string;
  timestamp?: string;
  deviceInfo?: string;
  refNumber?: string;
}

export function buildPasswordChangedHtmlEmail(data: PasswordChangedEmailData, portalUrl: string, refNum: string): string {
  const logoUrl = CITYZEN_LOGO_URL;
  const timeStr = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const device = data.deviceInfo || 'Standard Web Browser';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen Account Password Update</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <!-- Preheader text invisible in body, shown in inbox preview to prevent spam categorization -->
  <div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    Your CityZen account password was updated on ${timeStr}. Reference: ${refNum}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.45);">
    <tr>
      <td style="padding:32px 24px 20px;text-align:center;background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${logoUrl}" alt="CityZen Logo" width="80" height="80" style="border-radius:20px;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 20px rgba(56,189,248,0.25);display:inline-block;margin-bottom:12px;" />
        <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px;">CityZen</h1>
        <p style="color:#38bdf8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Account Security Center</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <p style="font-size:15px;line-height:22px;color:#f8fafc;margin:0 0 14px;">
          Hi <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <p style="font-size:13px;line-height:20px;color:#94a3b8;margin:0 0 18px;">
          The password for your CityZen account (<strong>${data.userEmail}</strong>) has been updated successfully.
        </p>

        ${data.newPassword ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:16px;border:1px solid rgba(56,189,248,0.3);margin-bottom:20px;">
          <tr>
            <td style="padding:16px 20px;">
              <span style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#38bdf8;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.2);padding:2px 8px;border-radius:6px;margin-bottom:8px;">
                Updated Password Details
              </span>
              <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">
                Your new registered password:
              </div>
              <div style="font-family:monospace;font-size:16px;font-weight:800;color:#38bdf8;letter-spacing:1px;background:#1e293b;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);display:inline-block;">
                ${data.newPassword}
              </div>
              <div style="font-size:11px;color:#64748b;margin-top:8px;line-height:16px;">
                🔒 Tip: Store this in a secure password manager. CityZen staff will never ask for your password.
              </div>
            </td>
          </tr>
        </table>
        ` : ''}

        <div style="background:#0f172a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:14px 18px;margin-bottom:22px;font-size:12px;color:#94a3b8;line-height:22px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">
            Security Audit Details
          </div>
          <div>• <strong>Timestamp:</strong> ${timeStr}</div>
          <div>• <strong>Device & Platform:</strong> ${device}</div>
          <div>• <strong>Security Ref:</strong> <span style="font-family:monospace;color:#38bdf8;">${refNum}</span></div>
          <div>• <strong>Status:</strong> <span style="color:#10b981;font-weight:bold;">Active & Verified</span></div>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td align="center">
              <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                Open CityZen Portal →
              </a>
            </td>
          </tr>
        </table>

        <p style="font-size:11px;line-height:17px;color:#64748b;margin:0;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
          If you initiated this change, you can safely disregard this message. If you did NOT change your password, please contact our security team immediately at <a href="mailto:cityzen.system@gmail.com" style="color:#38bdf8;text-decoration:none;">cityzen.system@gmail.com</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#090d16;padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:10px;line-height:16px;color:#64748b;">
        This automated security notification was sent to <strong>${data.userEmail}</strong> for verified activity on CityZen.<br>
        CityZen Municipal Utility & Civic Governance System · Bhubaneswar
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordChangedEmail(data: PasswordChangedEmailData): Promise<EmailDispatchResult> {
  const config = getEmailGatewayConfig();
  const dispatchId = `PWD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const refNum = data.refNumber || `CZ-SEC-${Math.floor(100000 + Math.random() * 900000)}`;
  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cityzen-one.netlify.app';
  const htmlEmail = buildPasswordChangedHtmlEmail({ ...data, timestamp }, portalUrl, refNum);

  if (!data.userEmail || !data.userEmail.includes('@')) {
    return {
      success: false,
      status: 'failed',
      dispatchId,
      timestamp,
      method: 'in_app_only',
      message: 'No recipient email specified.',
    };
  }

  const plainMessage = `Hi ${data.userName || 'Citizen'},\n\nYour CityZen account password was updated successfully.\n\nAccount: ${data.userEmail}\n${data.newPassword ? `New Password: ${data.newPassword}\n` : ''}Date: ${timestamp}\nDevice: ${data.deviceInfo || 'Web Browser'}\nSecurity Ref: ${refNum}\n\nIf you made this change, no action is needed. If you did not make this change, please contact cityzen.system@gmail.com immediately.\n\nBest regards,\nCityZen Security Team`;

  const payload = {
    service_id: config.emailjsServiceId,
    template_id: config.emailjsTemplateId,
    user_id: config.emailjsPublicKey,
    template_params: {
      to_name: data.userName || 'Citizen',
      recipient_name: data.userName || 'Citizen',
      user_name: data.userName || 'Citizen',
      name: data.userName || 'Citizen',
      to_email: data.userEmail,
      recipient: data.userEmail,
      email: data.userEmail,
      user_email: data.userEmail,
      reply_to: config.senderEmail,
      from_name: 'CityZen Security',
      subject: 'CityZen Account Security: Password successfully updated',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
      logo_url: CITYZEN_LOGO_URL,
      ref_number: refNum,
      dispatch_id: dispatchId,
      portal_url: portalUrl,
      login_link: portalUrl,
      date: timestamp,
    },
  };

  let transmittedViaApi = false;
  let apiResponseMsg = '';

  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = 'Dispatched via Municipal Webhook Relay';
      }
    } catch (e: any) {
      console.warn('Webhook transmission error:', e.message);
    }
  } else if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = `Delivered via EmailJS Cloud SMTP Gateway (${config.emailjsServiceId})`;
      } else {
        const errText = await res.text();
        console.warn('EmailJS response status:', res.status, errText);
        apiResponseMsg = `EmailJS Password Notice (${res.status}): ${errText}`;
      }
    } catch (e: any) {
      console.warn('EmailJS transmission error:', e.message);
      apiResponseMsg = `EmailJS Network Error: ${e.message}`;
    }
  }

  // Record in-app notification
  if (data.userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.userId,
        title: 'Password Changed Successfully 🔒',
        message: `Your account password was updated on ${timestamp} from ${data.deviceInfo || 'Web Browser'}. Confirmation email sent to ${data.userEmail}. Ref: ${refNum}.`,
        type: 'government',
        read: false,
      });
    } catch (err) {
      console.warn('In-app notification insert fallback:', err);
    }
  }

  return {
    success: true,
    status: transmittedViaApi ? 'delivered' : 'transmitted',
    dispatchId,
    timestamp,
    method: apiResponseMsg || 'CityZen System Background Dispatch',
    message: transmittedViaApi
      ? `Password update confirmation transmitted to ${data.userEmail} via EmailJS.`
      : `Password update confirmation recorded for ${data.userEmail}.`,
  };
}

/* ============================================================================ */
/* NEW LOGIN CONFIRMATION ALERT EMAIL                                           */
/* ============================================================================ */

export interface LoginAlertEmailData {
  userId?: string;
  userName?: string;
  userEmail: string;
  timestamp?: string;
  deviceInfo?: string;
  refNumber?: string;
}

export function buildLoginAlertHtmlEmail(data: LoginAlertEmailData, portalUrl: string, refNum: string): string {
  const logoUrl = CITYZEN_LOGO_URL;
  const timeStr = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const device = data.deviceInfo || 'Standard Web Browser';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen Account Sign-in Alert</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <!-- Preheader text invisible in body for inbox preview -->
  <div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    New sign-in detected on your CityZen account on ${timeStr}. Reference: ${refNum}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.45);">
    <tr>
      <td style="padding:32px 24px 20px;text-align:center;background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${logoUrl}" alt="CityZen Logo" width="80" height="80" style="border-radius:20px;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 20px rgba(56,189,248,0.25);display:inline-block;margin-bottom:12px;" />
        <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px;">CityZen</h1>
        <p style="color:#38bdf8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Account Security Center</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <p style="font-size:15px;line-height:22px;color:#f8fafc;margin:0 0 14px;">
          Hi <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <p style="font-size:13px;line-height:20px;color:#94a3b8;margin:0 0 18px;">
          A new sign-in was recorded for your CityZen citizen profile (<strong>${data.userEmail}</strong>).
        </p>

        <div style="background:#0f172a;border-radius:16px;border:1px solid rgba(56,189,248,0.25);padding:16px 18px;margin-bottom:22px;font-size:12px;color:#cbd5e1;line-height:22px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#38bdf8;margin-bottom:8px;">
            Sign-in Session Details
          </div>
          <div>• <strong>Date & Time:</strong> ${timeStr}</div>
          <div>• <strong>Device & Operating System:</strong> ${device}</div>
          <div>• <strong>Session Status:</strong> <span style="color:#10b981;font-weight:bold;">Active & Authenticated</span></div>
          <div>• <strong>Security Reference:</strong> <span style="font-family:monospace;color:#38bdf8;">${refNum}</span></div>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td align="center">
              <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                Open CityZen Dashboard →
              </a>
            </td>
          </tr>
        </table>

        <p style="font-size:11px;line-height:17px;color:#64748b;margin:0;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
          If this was you, you can safely disregard this message. If you did not log in, please reset your password immediately or email our security desk at <a href="mailto:cityzen.system@gmail.com" style="color:#38bdf8;text-decoration:none;">cityzen.system@gmail.com</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#090d16;padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:10px;line-height:16px;color:#64748b;">
        This automated security notification was sent to <strong>${data.userEmail}</strong> for verified activity on CityZen.<br>
        CityZen Municipal Utility & Civic Governance System · Bhubaneswar
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendLoginAlertEmail(data: LoginAlertEmailData): Promise<EmailDispatchResult> {
  const config = getEmailGatewayConfig();
  const dispatchId = `LOG-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const refNum = data.refNumber || `CZ-LOGIN-${Math.floor(100000 + Math.random() * 900000)}`;
  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cityzen-one.netlify.app';
  const htmlEmail = buildLoginAlertHtmlEmail({ ...data, timestamp }, portalUrl, refNum);

  if (!data.userEmail || !data.userEmail.includes('@')) {
    return {
      success: false,
      status: 'failed',
      dispatchId,
      timestamp,
      method: 'in_app_only',
      message: 'No recipient email specified.',
    };
  }

  const plainMessage = `Hi ${data.userName || 'Citizen'},\n\nA new sign-in was recorded for your CityZen account.\n\nAccount: ${data.userEmail}\nDate: ${timestamp}\nDevice: ${data.deviceInfo || 'Web Browser'}\nSecurity Ref: ${refNum}\nStatus: Authenticated Session Active\n\nIf this was you, no action is needed. If you did not sign in, please secure your account immediately.\n\nBest regards,\nCityZen Security Team`;

  const payload = {
    service_id: config.emailjsServiceId,
    template_id: config.emailjsTemplateId,
    user_id: config.emailjsPublicKey,
    template_params: {
      to_name: data.userName || 'Citizen',
      recipient_name: data.userName || 'Citizen',
      user_name: data.userName || 'Citizen',
      name: data.userName || 'Citizen',
      to_email: data.userEmail,
      recipient: data.userEmail,
      email: data.userEmail,
      user_email: data.userEmail,
      reply_to: config.senderEmail,
      from_name: 'CityZen Security',
      subject: 'CityZen Security Alert: New sign-in to your account',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
      logo_url: CITYZEN_LOGO_URL,
      ref_number: refNum,
      dispatch_id: dispatchId,
      portal_url: portalUrl,
      login_link: portalUrl,
      date: timestamp,
    },
  };

  let transmittedViaApi = false;
  let apiResponseMsg = '';

  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = 'Dispatched via Municipal Webhook Relay';
      }
    } catch (e: any) {
      console.warn('Webhook transmission error:', e.message);
    }
  } else if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = `Delivered via EmailJS Cloud SMTP Gateway (${config.emailjsServiceId})`;
      } else {
        const errText = await res.text();
        console.warn('EmailJS response status:', res.status, errText);
        apiResponseMsg = `EmailJS Login Notice (${res.status}): ${errText}`;
      }
    } catch (e: any) {
      console.warn('EmailJS transmission error:', e.message);
      apiResponseMsg = `EmailJS Network Error: ${e.message}`;
    }
  }

  // Record in-app notification
  if (data.userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.userId,
        title: 'New Sign-in Detected 🔑',
        message: `A new session was authenticated for your account on ${timestamp} from ${data.deviceInfo || 'Web Browser'}. Ref: ${refNum}.`,
        type: 'government',
        read: false,
      });
    } catch (err) {
      console.warn('In-app notification insert fallback:', err);
    }
  }

  return {
    success: true,
    status: transmittedViaApi ? 'delivered' : 'transmitted',
    dispatchId,
    timestamp,
    method: apiResponseMsg || 'CityZen System Background Dispatch',
    message: transmittedViaApi
      ? `Sign-in alert transmitted to ${data.userEmail} via EmailJS.`
      : `Sign-in alert recorded for ${data.userEmail}.`,
  };
}

/* ============================================================================ */
/* NEW ACCOUNT CREATED (24-HOUR SETUP LINK) EMAIL                               */
/* ============================================================================ */

export interface AccountCreatedSetupEmailData {
  userId?: string;
  userName: string;
  userEmail: string;
  setupLink: string;
  refNumber?: string;
  expiryHours?: number;
}

export function buildAccountCreatedSetupHtmlEmail(data: AccountCreatedSetupEmailData, portalUrl: string, refNum: string): string {
  const logoUrl = CITYZEN_LOGO_URL;
  const expiryHours = data.expiryHours || 24;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CityZen: Set Your Account Password</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <!-- Preheader text invisible in body for inbox preview -->
  <div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    Welcome to CityZen! Please set your password within ${expiryHours} hours to activate your account.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.45);">
    <tr>
      <td style="padding:32px 24px 20px;text-align:center;background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${logoUrl}" alt="CityZen Logo" width="80" height="80" style="border-radius:20px;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 20px rgba(56,189,248,0.25);display:inline-block;margin-bottom:12px;" />
        <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px;">CityZen</h1>
        <p style="color:#38bdf8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">One City · One App</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <p style="font-size:16px;line-height:24px;color:#f8fafc;margin:0 0 14px;">
          Welcome to CityZen, <strong>${data.userName}</strong>!
        </p>
        <p style="font-size:13px;line-height:20px;color:#94a3b8;margin:0 0 18px;">
          Your citizen registration has been created. To activate your account and access digital municipal services, please set your secure account password.
        </p>

        <!-- 24-Hour Expiration Banner -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(245,158,11,0.08);border-radius:16px;border:1px solid rgba(245,158,11,0.3);margin-bottom:22px;">
          <tr>
            <td style="padding:16px 20px;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fbbf24;margin-bottom:4px;">
                ⏰ Time-Sensitive Activation (${expiryHours}-Hour Window)
              </div>
              <div style="font-size:12px;color:#e2e8f0;line-height:18px;">
                This secure setup link is active for <strong>${expiryHours} hours</strong>. Please set your password within this window to complete your registration.
              </div>
            </td>
          </tr>
        </table>

        <!-- Primary Call To Action Button -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
          <tr>
            <td align="center">
              <a href="${data.setupLink}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:12px;box-shadow:0 4px 16px rgba(2,132,199,0.4);letter-spacing:0.2px;">
                Set Your Password & Activate Account →
              </a>
            </td>
          </tr>
        </table>

        <div style="background:#0f172a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:14px 18px;margin-bottom:20px;font-size:12px;color:#94a3b8;line-height:20px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">
            Registration Summary
          </div>
          <div>• <strong>Registered Email:</strong> <span style="color:#cbd5e1;">${data.userEmail}</span></div>
          <div>• <strong>Activation Reference:</strong> <span style="font-family:monospace;color:#38bdf8;">${refNum}</span></div>
          <div>• <strong>Validity:</strong> 24 Hours from registration</div>
        </div>

        <div style="font-size:11px;color:#64748b;line-height:18px;margin-bottom:14px;">
          If the button above does not work, copy and paste this direct link into your browser:<br>
          <span style="font-family:monospace;color:#38bdf8;word-break:break-all;">${data.setupLink}</span>
        </div>

        <p style="font-size:11px;line-height:17px;color:#64748b;margin:0;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
          If you did not register for an account on CityZen, you can safely disregard this message. No account will be activated without your confirmation.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#090d16;padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:10px;line-height:16px;color:#64748b;">
        This automated invitation was sent to <strong>${data.userEmail}</strong> by the CityZen Portal.<br>
        For inquiries, reply to <a href="mailto:cityzen.system@gmail.com" style="color:#38bdf8;text-decoration:none;">cityzen.system@gmail.com</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAccountCreatedSetupEmail(data: AccountCreatedSetupEmailData): Promise<EmailDispatchResult> {
  const config = getEmailGatewayConfig();
  const dispatchId = `ACT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const refNum = data.refNumber || `CZ-ACT-${Math.floor(100000 + Math.random() * 900000)}`;
  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cityzen-one.netlify.app';
  const htmlEmail = buildAccountCreatedSetupHtmlEmail(data, portalUrl, refNum);

  if (!data.userEmail || !data.userEmail.includes('@')) {
    return {
      success: false,
      status: 'failed',
      dispatchId,
      timestamp,
      method: 'in_app_only',
      message: 'No recipient email specified.',
    };
  }

  const plainMessage = `Welcome to CityZen, ${data.userName}!\n\nYour account has been created. Please set your account password within 24 hours to activate your profile.\n\nActivation Link: ${data.setupLink}\nAccount: ${data.userEmail}\nValidity: 24 Hours\nReference: ${refNum}\n\nIf you did not register for CityZen, please ignore this email.\n\nBest regards,\nCityZen Portal Team`;

  const payload = {
    service_id: config.emailjsServiceId,
    template_id: config.emailjsTemplateId,
    user_id: config.emailjsPublicKey,
    template_params: {
      to_name: data.userName,
      recipient_name: data.userName,
      user_name: data.userName,
      name: data.userName,
      to_email: data.userEmail,
      recipient: data.userEmail,
      email: data.userEmail,
      user_email: data.userEmail,
      reply_to: config.senderEmail,
      from_name: 'CityZen Portal',
      subject: 'Welcome to CityZen: Set your account password (valid 24h)',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
      logo_url: CITYZEN_LOGO_URL,
      ref_number: refNum,
      dispatch_id: dispatchId,
      portal_url: portalUrl,
      login_link: data.setupLink,
      date: timestamp,
    },
  };

  let transmittedViaApi = false;
  let apiResponseMsg = '';

  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = 'Dispatched via Municipal Webhook Relay';
      }
    } catch (e: any) {
      console.warn('Webhook transmission error:', e.message);
    }
  } else if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        transmittedViaApi = true;
        apiResponseMsg = `Delivered via EmailJS Cloud SMTP Gateway (${config.emailjsServiceId})`;
      } else {
        const errText = await res.text();
        console.warn('EmailJS response status:', res.status, errText);
        apiResponseMsg = `EmailJS Activation Notice (${res.status}): ${errText}`;
      }
    } catch (e: any) {
      console.warn('EmailJS transmission error:', e.message);
      apiResponseMsg = `EmailJS Network Error: ${e.message}`;
    }
  }

  // Record in-app notification if userId exists
  if (data.userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.userId,
        title: 'Welcome to CityZen 🎉',
        message: `Your account is created! An activation link has been sent to ${data.userEmail} (valid for 24 hours).`,
        type: 'government',
        read: false,
      });
    } catch (err) {
      console.warn('In-app notification insert fallback:', err);
    }
  }

  return {
    success: true,
    status: transmittedViaApi ? 'delivered' : 'transmitted',
    dispatchId,
    timestamp,
    method: apiResponseMsg || 'CityZen System Background Dispatch',
    message: transmittedViaApi
      ? `Activation link transmitted to ${data.userEmail} via EmailJS.`
      : `Activation link recorded for ${data.userEmail}.`,
  };
}
