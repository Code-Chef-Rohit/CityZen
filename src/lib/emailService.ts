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
