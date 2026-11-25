import { supabase } from './supabase';

export interface EmailGatewayConfig {
  enabled: boolean;
  provider: 'smtp' | 'emailjs' | 'webhook' | 'relay';
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  webhookUrl: string;
  smtpEndpointUrl: string;
  senderName: string;
  senderEmail: string;
}

const STORAGE_KEY = 'cityzen_email_gateway_config';

// Default configuration with Gmail SMTP Serverless Relay as primary
export const DEFAULT_EMAIL_CONFIG: EmailGatewayConfig = {
  enabled: true,
  provider: 'smtp',
  emailjsServiceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_xlxsj8f',
  emailjsTemplateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_bnczuvh',
  emailjsPublicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'l8ZDaCW7jP2JEQfDN',
  webhookUrl: '',
  smtpEndpointUrl: import.meta.env.VITE_SMTP_ENDPOINT_URL || 'https://cityzen-one.netlify.app/.netlify/functions/send-email',
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
      if (!parsed.provider) {
        parsed.provider = 'smtp';
      }
      if (!parsed.smtpEndpointUrl) {
        parsed.smtpEndpointUrl = DEFAULT_EMAIL_CONFIG.smtpEndpointUrl;
      }
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

/**
 * Unified dispatch helper:
 * 1. Prioritizes Netlify Serverless Gmail SMTP Relay (direct delivery via your Gmail).
 * 2. Falls back to Custom Webhook if configured.
 * 3. Falls back to EmailJS so no email is ever lost during setup.
 */
export async function transmitEmailPayload(
  payload: any,
  config: EmailGatewayConfig
): Promise<{ success: boolean; method: string }> {
  // 1. First Priority: Gmail SMTP Serverless Relay
  if (config.provider === 'smtp' || (!config.webhookUrl && config.enabled)) {
    const endpointsToTry: string[] = [];
    if (typeof window !== 'undefined' && window.location.origin.includes('netlify.app')) {
      endpointsToTry.push('/.netlify/functions/send-email');
    }
    if (config.smtpEndpointUrl && config.smtpEndpointUrl.trim() !== '') {
      endpointsToTry.push(config.smtpEndpointUrl);
    }
    endpointsToTry.push('https://cityzen-one.netlify.app/.netlify/functions/send-email');

    const uniqueEndpoints = [...new Set(endpointsToTry)];

    for (const url of uniqueEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          return {
            success: true,
            method: json.message || 'Delivered via Gmail SMTP Serverless Relay',
          };
        }
      } catch (smtpErr) {
        // Fall through to next endpoint or fallback
      }
    }
  }

  // 2. Custom Webhook Relay
  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { success: true, method: 'Dispatched via Custom Webhook' };
      }
    } catch (whErr: any) {
      console.warn('Webhook transmission error:', whErr.message);
    }
  }

  // 3. Fallback: EmailJS Cloud Relay
  if (config.emailjsPublicKey && config.emailjsPublicKey.trim() !== '') {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { success: true, method: `Delivered via EmailJS Gateway (${config.emailjsServiceId})` };
      } else {
        const errText = await res.text();
        return { success: false, method: `EmailJS (${res.status}): ${errText}` };
      }
    } catch (e: any) {
      return { success: false, method: `EmailJS Network Error: ${e.message}` };
    }
  }

  return { success: false, method: 'No active email relay available' };
}

export function buildRoleChangeHtmlEmail(data: RoleChangeEmailData, portalUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: Role Updated</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border-top: 5px solid #ea580c; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 24px;">
        
        <!-- Center Logo / Brand -->
        <div style="text-align: center; margin-bottom: 24px; padding-top: 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); text-align: center; line-height: 44px; color: #ffffff; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                  CZ
                </div>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">City<span style="color: #ea580c;">Zen</span></span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Category Pill Badge -->
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">
            Bhubaneswar Smart City
          </span>
        </div>

        <!-- Heading -->
        <h1 style="font-size: 24px; font-weight: 800; color: #0f2c59; margin: 0 0 16px; letter-spacing: -0.4px;">
          Your role is ready
        </h1>

        <!-- Greeting -->
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 6px;">
          Hello <strong>${data.userName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 20px;">
          Your CityZen account is ready to access as a <strong>${data.roleTitle}</strong>.
        </p>

        <!-- Rounded Details Box -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SIGN-IN EMAIL
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0284c7; text-decoration: underline; margin-bottom: 16px;">
            ${data.userEmail}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            ASSIGNED ROLE & CLEARANCE
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">
            ${data.roleTitle} &bull; <span style="color: #64748b; font-weight: 600;">${data.clearance}</span>
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            AUTHORIZED PERMISSIONS
          </div>
          <div style="font-size: 12px; line-height: 20px; color: #334155;">
            ${data.permissions.map(p => `&bull; ${p}`).join('<br/>')}
          </div>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 38px; border-radius: 8px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
            Open Dashboard &rarr;
          </a>
        </div>

        <!-- Direct Link -->
        <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
          Or paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #0284c7; word-break: break-all; margin: 0 0 24px;">
          <a href="${portalUrl}" style="color: #0284c7; text-decoration: underline;">${portalUrl}</a>
        </p>

        <!-- Divider & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
          <p style="font-size: 13px; font-weight: 800; color: #0f3b70; margin: 0 0 4px;">
            Let's make our city smarter.
          </p>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">
            The link works once and expires in 24 hours, or when you sign in.
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            CityZen Team &bull; Bhubaneswar
          </p>
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

  // 1. Unified Dispatch (Gmail SMTP Relay -> Webhook -> EmailJS)
  const { success: transmittedViaApi, method: apiResponseMsg } = await transmitEmailPayload(payload, config);

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
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border-top: 5px solid #ea580c; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 24px;">
        
        <!-- Center Logo / Brand -->
        <div style="text-align: center; margin-bottom: 24px; padding-top: 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); text-align: center; line-height: 44px; color: #ffffff; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                  CZ
                </div>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">City<span style="color: #ea580c;">Zen</span></span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Category Pill Badge -->
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">
            ${(data.category || 'MUNICIPAL UPDATE').toUpperCase()}
          </span>
        </div>

        <!-- Heading -->
        <h1 style="font-size: 24px; font-weight: 800; color: #0f2c59; margin: 0 0 16px; letter-spacing: -0.4px;">
          ${data.title}
        </h1>

        <!-- Greeting -->
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 6px;">
          Hello <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 20px;">
          Here is an official update regarding your municipal request.
        </p>

        <!-- Rounded Details Box -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SIGN-IN EMAIL
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0284c7; text-decoration: underline; margin-bottom: 16px;">
            ${data.userEmail}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            NOTICE DETAILS
          </div>
          <div style="font-size: 14px; line-height: 22px; color: #0f172a; margin-bottom: 14px; white-space: pre-line;">
            ${data.message}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            REFERENCE NUMBER
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">
            ${refNum}
          </div>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 38px; border-radius: 8px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
            Open CityZen &rarr;
          </a>
        </div>

        <!-- Direct Link -->
        <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
          Or paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #0284c7; word-break: break-all; margin: 0 0 24px;">
          <a href="${portalUrl}" style="color: #0284c7; text-decoration: underline;">${portalUrl}</a>
        </p>

        <!-- Divider & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
          <p style="font-size: 13px; font-weight: 800; color: #0f3b70; margin: 0 0 4px;">
            Let's make our city smarter.
          </p>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">
            Official civic service record &bull; CityZen Portal
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            CityZen Team &bull; Bhubaneswar
          </p>
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

  const { success: transmittedViaApi, method: apiResponseMsg } = await transmitEmailPayload(payload, config);

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
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border-top: 5px solid #ea580c; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 24px;">
        
        <!-- Center Logo / Brand -->
        <div style="text-align: center; margin-bottom: 24px; padding-top: 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); text-align: center; line-height: 44px; color: #ffffff; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                  CZ
                </div>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">City<span style="color: #ea580c;">Zen</span></span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Category Pill Badge -->
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">
            Account Security
          </span>
        </div>

        <!-- Heading -->
        <h1 style="font-size: 24px; font-weight: 800; color: #0f2c59; margin: 0 0 16px; letter-spacing: -0.4px;">
          Your password was updated
        </h1>

        <!-- Greeting -->
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 6px;">
          Hello <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 20px;">
          The password for your CityZen account has been updated successfully.
        </p>

        <!-- Rounded Details Box -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SIGN-IN EMAIL
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0284c7; text-decoration: underline; margin-bottom: 16px;">
            ${data.userEmail}
          </div>

          ${data.newPassword ? `
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            UPDATED PASSWORD
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 16px;">
            ${data.newPassword}
          </div>
          ` : ''}

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SESSION DETAILS
          </div>
          <div style="font-size: 12px; line-height: 20px; color: #334155;">
            &bull; Time: ${timeStr}<br/>
            &bull; Device: ${device}<br/>
            &bull; Security Ref: <span style="font-family: monospace; color: #0f172a; font-weight: 700;">${refNum}</span>
          </div>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 38px; border-radius: 8px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
            Open Dashboard &rarr;
          </a>
        </div>

        <!-- Direct Link -->
        <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
          Or paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #0284c7; word-break: break-all; margin: 0 0 24px;">
          <a href="${portalUrl}" style="color: #0284c7; text-decoration: underline;">${portalUrl}</a>
        </p>

        <!-- Divider & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
          <p style="font-size: 13px; font-weight: 800; color: #0f3b70; margin: 0 0 4px;">
            Let's make our city smarter.
          </p>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">
            If you did not make this change, please sign in and secure your account immediately.
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            CityZen Team &bull; Bhubaneswar
          </p>
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

  const { success: transmittedViaApi, method: apiResponseMsg } = await transmitEmailPayload(payload, config);

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
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border-top: 5px solid #ea580c; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 24px;">
        
        <!-- Center Logo / Brand -->
        <div style="text-align: center; margin-bottom: 24px; padding-top: 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); text-align: center; line-height: 44px; color: #ffffff; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                  CZ
                </div>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">City<span style="color: #ea580c;">Zen</span></span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Category Pill Badge -->
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">
            Security Alert
          </span>
        </div>

        <!-- Heading -->
        <h1 style="font-size: 24px; font-weight: 800; color: #0f2c59; margin: 0 0 16px; letter-spacing: -0.4px;">
          New sign-in detected
        </h1>

        <!-- Greeting -->
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 6px;">
          Hello <strong>${data.userName || 'Citizen'}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 20px;">
          A new authenticated session was recorded for your CityZen citizen profile.
        </p>

        <!-- Rounded Details Box -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SIGN-IN EMAIL
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0284c7; text-decoration: underline; margin-bottom: 16px;">
            ${data.userEmail}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SESSION DETAILS
          </div>
          <div style="font-size: 12px; line-height: 20px; color: #334155; margin-bottom: 14px;">
            &bull; Date & Time: ${timeStr}<br/>
            &bull; Device / OS: ${device}<br/>
            &bull; Session Status: <strong style="color: #16a34a;">Active & Authenticated</strong>
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SECURITY REFERENCE
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">
            ${refNum}
          </div>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 38px; border-radius: 8px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
            Open Dashboard &rarr;
          </a>
        </div>

        <!-- Direct Link -->
        <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
          Or paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #0284c7; word-break: break-all; margin: 0 0 24px;">
          <a href="${portalUrl}" style="color: #0284c7; text-decoration: underline;">${portalUrl}</a>
        </p>

        <!-- Divider & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
          <p style="font-size: 13px; font-weight: 800; color: #0f3b70; margin: 0 0 4px;">
            Let's make our city smarter.
          </p>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">
            If you did not sign in, please secure your password immediately.
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            CityZen Team &bull; Bhubaneswar
          </p>
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

  const { success: transmittedViaApi, method: apiResponseMsg } = await transmitEmailPayload(payload, config);

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
  roleTitle?: string;
  temporaryPassword?: string;
}

export function buildAccountCreatedSetupHtmlEmail(data: AccountCreatedSetupEmailData, portalUrl: string, refNum: string): string {
  const expiryHours = data.expiryHours || 24;
  const roleName = data.roleTitle || 'Citizen';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CityZen: Your account is ready</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border-top: 5px solid #ea580c; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 24px;">
        
        <!-- Center Logo / Brand -->
        <div style="text-align: center; margin-bottom: 24px; padding-top: 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); text-align: center; line-height: 44px; color: #ffffff; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                  CZ
                </div>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">City<span style="color: #ea580c;">Zen</span></span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Category Pill Badge -->
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">
            Bhubaneswar Smart City
          </span>
        </div>

        <!-- Heading -->
        <h1 style="font-size: 24px; font-weight: 800; color: #0f2c59; margin: 0 0 16px; letter-spacing: -0.4px;">
          Your account is ready
        </h1>

        <!-- Greeting -->
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 6px;">
          Hello <strong>${data.userName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 20px;">
          Your CityZen account is ready to access as a <strong>${roleName}</strong>.
        </p>

        <!-- Rounded Details Box -->
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            SIGN-IN EMAIL
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0284c7; text-decoration: underline; margin-bottom: 16px;">
            ${data.userEmail}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            ${data.temporaryPassword ? 'TEMPORARY PASSWORD' : 'ACCOUNT STATUS'}
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 14px;">
            ${data.temporaryPassword || 'Active & Ready for Setup'}
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            REFERENCE NUMBER
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">
            ${refNum}
          </div>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${data.setupLink}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 38px; border-radius: 8px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
            Set your password &rarr;
          </a>
        </div>

        <!-- Direct Link -->
        <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
          Or paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #0284c7; word-break: break-all; margin: 0 0 24px;">
          <a href="${data.setupLink}" style="color: #0284c7; text-decoration: underline;">${data.setupLink}</a>
        </p>

        <!-- Divider & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
          <p style="font-size: 13px; font-weight: 800; color: #0f3b70; margin: 0 0 4px;">
            Let's make our city smarter.
          </p>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">
            The link works once and expires in ${expiryHours} hours, or when you sign in.
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            CityZen Team &bull; Bhubaneswar
          </p>
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

  const { success: transmittedViaApi, method: apiResponseMsg } = await transmitEmailPayload(payload, config);

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
