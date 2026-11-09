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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: Role Updated</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:20px;font-weight:800;color:#0284c7;letter-spacing:-0.5px;">CityZen</span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="font-size:15px;line-height:24px;color:#0f172a;margin:0 0 16px;">
          Hi ${data.userName},
        </p>
        <p style="font-size:14px;line-height:22px;color:#334155;margin:0 0 20px;">
          Your account role has been updated to <strong>${data.roleTitle}</strong>.
        </p>

        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Role Details</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">${data.roleTitle}</div>
          <div style="font-size:13px;color:#475569;">${data.clearance}</div>
        </div>

        <div style="margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Included Features</div>
          <ul style="margin:0;padding-left:20px;font-size:13px;line-height:22px;color:#334155;">
            ${data.permissions.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Open Dashboard
          </a>
        </div>

        <div style="border-top:1px solid #f1f5f9;padding-top:14px;font-size:12px;color:#64748b;">
          Account: <strong style="color:#334155;">${data.userEmail}</strong>
        </div>
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
      from_name: 'CityZen',
      subject: data.subject || 'CityZen: Role Updated',
      message: data.body,
      message_body: data.body,
      content: data.body,
      body: data.body,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
      login_link: portalUrl,
      portal_url: portalUrl,
      new_role: data.newRole.toUpperCase(),
      role: data.newRole.toUpperCase(),
      role_title: data.roleTitle,
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
        apiResponseMsg = 'Dispatched via Webhook Relay';
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
        apiResponseMsg = `Delivered via EmailJS Cloud Gateway (${config.emailjsServiceId})`;
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

  // 2. In-App Notification Recording
  try {
    await supabase.from('notifications').insert({
      user_id: data.userId,
      title: `Role Updated: ${data.newRole.toUpperCase()}`,
      message: `Your account role has been updated to ${data.newRole.toUpperCase()} (${data.roleTitle}). Please log in to access your authorized dashboard controls.`,
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
    method: apiResponseMsg || 'CityZen System Background Dispatch',
    message: transmittedViaApi
      ? `Notification delivered to ${data.userEmail} (Ref: ${data.refNumber}).`
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:20px;font-weight:800;color:#0284c7;letter-spacing:-0.5px;">CityZen</span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="font-size:15px;line-height:24px;color:#0f172a;margin:0 0 16px;">
          Hi ${data.userName || 'Citizen'},
        </p>
        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;">
          <h2 style="font-size:15px;font-weight:700;color:#0284c7;margin:0 0 8px;">${data.title}</h2>
          <p style="font-size:13px;line-height:22px;color:#334155;margin:0;white-space:pre-line;">${data.message}</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Open CityZen
          </a>
        </div>
        <div style="border-top:1px solid #f1f5f9;padding-top:14px;font-size:12px;color:#64748b;">
          Ref: <strong style="color:#334155;">${refNum}</strong>
        </div>
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
      from_name: 'CityZen',
      subject: data.subject || data.title || 'CityZen Notice',
      message: data.message,
      message_body: data.message,
      content: data.message,
      html_message: htmlNotice,
      html_content: htmlNotice,
      message_html: htmlNotice,
      body_html: htmlNotice,
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
  const timeStr = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const device = data.deviceInfo || 'Standard Web Browser';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: Password Updated</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:20px;font-weight:800;color:#0284c7;letter-spacing:-0.5px;">CityZen</span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="font-size:15px;line-height:24px;color:#0f172a;margin:0 0 16px;">
          Hi ${data.userName || 'Citizen'},
        </p>
        <p style="font-size:14px;line-height:22px;color:#334155;margin:0 0 20px;">
          The password for your CityZen account has been updated successfully.
        </p>

        ${data.newPassword ? `
        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Updated Password</div>
          <div style="font-family:monospace;font-size:15px;font-weight:700;color:#0f172a;">${data.newPassword}</div>
        </div>
        ` : ''}

        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;font-size:13px;color:#334155;line-height:22px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Details</div>
          <div>• <strong>Account:</strong> ${data.userEmail}</div>
          <div>• <strong>Time:</strong> ${timeStr}</div>
          <div>• <strong>Device:</strong> ${device}</div>
          <div>• <strong>Ref:</strong> ${refNum}</div>
        </div>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Open Dashboard
          </a>
        </div>

        <div style="border-top:1px solid #f1f5f9;padding-top:14px;font-size:12px;color:#64748b;">
          If you did not make this change, please log in and update your password immediately.
        </div>
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

  const plainMessage = `Hi ${data.userName || 'Citizen'},\n\nYour CityZen account password was updated successfully.\n\nAccount: ${data.userEmail}\n${data.newPassword ? `Password: ${data.newPassword}\n` : ''}Time: ${timestamp}\nDevice: ${data.deviceInfo || 'Standard Web Browser'}\nRef: ${refNum}\n\nIf you did not make this change, please log in and update your password immediately.\n\nDashboard: ${portalUrl}`;

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
      from_name: 'CityZen',
      subject: 'CityZen: Password Updated',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
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
        apiResponseMsg = `Delivered via EmailJS Gateway (${config.emailjsServiceId})`;
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
        title: 'Password Updated',
        message: `Your account password was updated on ${timestamp}. Ref: ${refNum}.`,
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
      ? `Password update confirmation delivered to ${data.userEmail}.`
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
  const timeStr = data.timestamp || new Date().toLocaleString('en-IN', { timeZoneName: 'short' });
  const device = data.deviceInfo || 'Standard Web Browser';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: New Sign-in Alert</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:20px;font-weight:800;color:#0284c7;letter-spacing:-0.5px;">CityZen</span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="font-size:15px;line-height:24px;color:#0f172a;margin:0 0 16px;">
          Hi ${data.userName || 'Citizen'},
        </p>
        <p style="font-size:14px;line-height:22px;color:#334155;margin:0 0 20px;">
          A new sign-in was recorded for your CityZen account.
        </p>

        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;font-size:13px;color:#334155;line-height:22px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Sign-in Details</div>
          <div>• <strong>Account:</strong> ${data.userEmail}</div>
          <div>• <strong>Time:</strong> ${timeStr}</div>
          <div>• <strong>Device:</strong> ${device}</div>
          <div>• <strong>Ref:</strong> ${refNum}</div>
        </div>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Open Dashboard
          </a>
        </div>

        <div style="border-top:1px solid #f1f5f9;padding-top:14px;font-size:12px;color:#64748b;">
          If this was not you, please log in and update your password immediately.
        </div>
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

  const plainMessage = `Hi ${data.userName || 'Citizen'},\n\nA new sign-in was recorded for your CityZen account.\n\nAccount: ${data.userEmail}\nTime: ${timestamp}\nDevice: ${data.deviceInfo || 'Standard Web Browser'}\nRef: ${refNum}\n\nIf this was not you, please log in and update your password immediately.\n\nDashboard: ${portalUrl}`;

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
      from_name: 'CityZen',
      subject: 'CityZen: New Sign-in Alert',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
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
        apiResponseMsg = `Delivered via EmailJS Gateway (${config.emailjsServiceId})`;
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
        title: 'New Sign-in Detected',
        message: `A new session was authenticated for your account on ${timestamp}. Ref: ${refNum}.`,
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
      ? `Sign-in alert delivered to ${data.userEmail}.`
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
  const expiryHours = data.expiryHours || 24;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: Set Your Password</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:20px;font-weight:800;color:#0284c7;letter-spacing:-0.5px;">CityZen</span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="font-size:15px;line-height:24px;color:#0f172a;margin:0 0 16px;">
          Welcome to CityZen, ${data.userName}!
        </p>
        <p style="font-size:14px;line-height:22px;color:#334155;margin:0 0 20px;">
          Your account has been created. Please set your password within ${expiryHours} hours to activate your profile.
        </p>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${data.setupLink}" target="_blank" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Set Your Password
          </a>
        </div>

        <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;font-size:13px;color:#334155;line-height:22px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Account Summary</div>
          <div>• <strong>Account:</strong> ${data.userEmail}</div>
          <div>• <strong>Validity:</strong> ${expiryHours} hours</div>
          <div>• <strong>Ref:</strong> ${refNum}</div>
        </div>

        <div style="font-size:12px;color:#64748b;line-height:18px;margin-bottom:14px;word-break:break-all;">
          Direct link: <a href="${data.setupLink}" style="color:#0284c7;text-decoration:underline;">${data.setupLink}</a>
        </div>

        <div style="border-top:1px solid #f1f5f9;padding-top:14px;font-size:12px;color:#64748b;">
          If you did not register for an account on CityZen, you can safely disregard this message.
        </div>
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

  const plainMessage = `Welcome to CityZen, ${data.userName}!\n\nYour account has been created. Please set your account password within ${data.expiryHours || 24} hours to complete your registration.\n\nSetup Link: ${data.setupLink}\nAccount: ${data.userEmail}\nValidity: ${data.expiryHours || 24} Hours\nRef: ${refNum}\n\nIf you did not create an account on CityZen, you can safely ignore this message.`;

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
      from_name: 'CityZen',
      subject: 'CityZen: Set Your Password',
      message: plainMessage,
      message_body: plainMessage,
      content: plainMessage,
      html_message: htmlEmail,
      html_content: htmlEmail,
      message_html: htmlEmail,
      body_html: htmlEmail,
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
        apiResponseMsg = `Delivered via EmailJS Gateway (${config.emailjsServiceId})`;
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
        title: 'Welcome to CityZen',
        message: `Your account is created. An activation link has been sent to ${data.userEmail} (valid for 24 hours).`,
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
      ? `Activation link delivered to ${data.userEmail}.`
      : `Activation link recorded for ${data.userEmail}.`,
  };
}
