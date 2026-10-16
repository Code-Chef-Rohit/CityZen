import { supabase } from './supabase';
import { sendAutomatedCitizenNoticeEmail } from './emailService';

export const DELETION_REGISTRATION_LOCK_DAYS = 3;
export const DELETION_WAIT_DAYS = 7;

const REGISTRY_STORAGE_KEY = 'cityzen_deletion_schedules_registry';

export interface DeletionScheduleEntry {
  userId: string;
  userName: string;
  userEmail: string;
  requestedAt: string;
  scheduledAt: string;
  status: 'scheduled' | 'cancelled' | 'executed';
  reason?: string;
  modifiedByAdmin?: boolean;
}

/**
 * Reads local deletion registry cache
 */
export function getLocalDeletionRegistry(): Record<string, DeletionScheduleEntry> {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Saves local deletion registry cache
 */
export function saveLocalDeletionRegistry(registry: Record<string, DeletionScheduleEntry>): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn('Failed to save deletion registry:', e);
  }
}

/**
 * Check whether a user is within the 3-day restriction period after account opening
 */
export function checkAccountCreationLock(createdAtString?: string | null): {
  isLocked: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  unlockDate: Date;
  message: string;
} {
  if (!createdAtString) {
    return {
      isLocked: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      unlockDate: new Date(),
      message: 'Account eligible for deletion.',
    };
  }

  const createdTime = new Date(createdAtString).getTime();
  const lockDurationMs = DELETION_REGISTRATION_LOCK_DAYS * 24 * 60 * 60 * 1000;
  const unlockTime = createdTime + lockDurationMs;
  const now = Date.now();

  if (now < unlockTime) {
    const diffMs = unlockTime - now;
    const daysRemaining = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const unlockDate = new Date(unlockTime);

    const timeText = daysRemaining > 0 
      ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} and ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`
      : `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;

    return {
      isLocked: true,
      daysRemaining,
      hoursRemaining,
      unlockDate,
      message: `Account deletion restricted: You cannot delete your account within 3 days of opening. Eligible in ${timeText} (on ${unlockDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}).`,
    };
  }

  return {
    isLocked: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    unlockDate: new Date(unlockTime),
    message: 'Account eligible for deletion.',
  };
}

/**
 * Formats time remaining for a scheduled deletion
 */
export function formatDeletionCountdown(scheduledAtString?: string | null): {
  isPassed: boolean;
  days: number;
  hours: number;
  minutes: number;
  text: string;
} {
  if (!scheduledAtString) {
    return { isPassed: false, days: 0, hours: 0, minutes: 0, text: 'No deletion scheduled' };
  }

  const target = new Date(scheduledAtString).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { isPassed: true, days: 0, hours: 0, minutes: 0, text: 'Grace period expired (Pending Purge)' };
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  let text = '';
  if (days > 0) {
    text = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m remaining`;
  } else {
    text = `${minutes}m remaining`;
  }

  return { isPassed: false, days, hours, minutes, text };
}

/**
 * Get active deletion schedule for a profile (checks profiles row, user metadata, and registry)
 */
export function getActiveDeletionSchedule(profile: any, metadata?: any): DeletionScheduleEntry | null {
  if (!profile?.id) return null;

  // 1. Check direct profile fields
  if (profile.deletion_status === 'scheduled' && profile.deletion_scheduled_at) {
    return {
      userId: profile.id,
      userName: profile.full_name || 'Citizen',
      userEmail: profile.email || '',
      requestedAt: profile.deletion_requested_at || profile.created_at,
      scheduledAt: profile.deletion_scheduled_at,
      status: 'scheduled',
      reason: profile.deletion_reason,
    };
  }

  // 2. Check metadata
  if (metadata?.deletion_status === 'scheduled' && metadata?.deletion_scheduled_at) {
    return {
      userId: profile.id,
      userName: profile.full_name || 'Citizen',
      userEmail: profile.email || '',
      requestedAt: metadata.deletion_requested_at,
      scheduledAt: metadata.deletion_scheduled_at,
      status: 'scheduled',
      reason: metadata.deletion_reason,
    };
  }

  // 3. Check registry cache
  const registry = getLocalDeletionRegistry();
  const entry = registry[profile.id];
  if (entry && entry.status === 'scheduled') {
    return entry;
  }

  return null;
}

/**
 * Request account deletion as citizen (enforces 3-day lock and initiates 7-day wait)
 */
export async function scheduleCitizenAccountDeletion(params: {
  userId: string;
  userName: string;
  userEmail: string;
  createdAt?: string;
  reason?: string;
}): Promise<{
  success: boolean;
  scheduledAt?: string;
  message: string;
}> {
  // 1. Enforce 3-day creation lock
  const lock = checkAccountCreationLock(params.createdAt);
  if (lock.isLocked) {
    return {
      success: false,
      message: lock.message,
    };
  }

  const requestedAt = new Date().toISOString();
  // 7 days grace waiting period
  const scheduledTime = Date.now() + DELETION_WAIT_DAYS * 24 * 60 * 60 * 1000;
  const scheduledAt = new Date(scheduledTime).toISOString();

  const entry: DeletionScheduleEntry = {
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    requestedAt,
    scheduledAt,
    status: 'scheduled',
    reason: params.reason,
  };

  // 2. Save in local registry
  const registry = getLocalDeletionRegistry();
  registry[params.userId] = entry;
  saveLocalDeletionRegistry(registry);

  // 3. Update Supabase Auth user metadata
  try {
    await supabase.auth.updateUser({
      data: {
        deletion_requested_at: requestedAt,
        deletion_scheduled_at: scheduledAt,
        deletion_status: 'scheduled',
        deletion_reason: params.reason || null,
      },
    });
  } catch (authErr) {
    console.warn('Auth metadata update notice:', authErr);
  }

  // 4. Update profiles table if columns exist
  try {
    await supabase.from('profiles').update({
      deletion_requested_at: requestedAt,
      deletion_scheduled_at: scheduledAt,
      deletion_status: 'scheduled',
      deletion_reason: params.reason || null,
    }).eq('id', params.userId);
  } catch (dbErr) {
    console.warn('Profiles table deletion columns notice:', dbErr);
  }

  // 5. Insert in-app notification
  const formattedScheduledDate = new Date(scheduledAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      title: '⚠️ Account Deletion Scheduled (7-Day Grace Period)',
      message: `Your CityZen account deletion request has been scheduled. Your account will be permanently erased on ${formattedScheduledDate}. You can cancel this request anytime from your profile before this date.`,
      type: 'government',
      read: false,
    });
  } catch (notifErr) {
    console.warn('In-app notification notice:', notifErr);
  }

  // 6. Send automated email via EmailJS
  if (params.userEmail) {
    sendAutomatedCitizenNoticeEmail({
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      title: 'Account Deletion Scheduled (7-Day Waiting Period)',
      subject: '[SECURITY NOTICE] CityZen Account Deletion Scheduled',
      message: `Dear ${params.userName || 'Citizen'},\n\nThis confirms that a request was initiated to delete your CityZen account.\n\nIn accordance with municipal privacy and security compliance, your account has entered a mandatory 7-day waiting period:\n• Request Date: ${new Date(requestedAt).toLocaleString('en-IN')}\n• Scheduled Permanent Deletion: ${formattedScheduledDate}\n\nDuring these 7 days, your account data remains intact. If you wish to cancel this deletion request, simply log in to your CityZen profile and click "Cancel Deletion Request".\n\nIf you did not initiate this request, please contact CityZen Admin immediately.\n\nCityZen Security Directorate`,
      category: 'government',
    }).catch(e => console.warn('Automated deletion notice email error:', e));
  }

  return {
    success: true,
    scheduledAt,
    message: `Account deletion scheduled for ${formattedScheduledDate}. You have a 7-day grace period to cancel.`,
  };
}

/**
 * Cancel a scheduled account deletion
 */
export async function cancelCitizenAccountDeletion(params: {
  userId: string;
  userName: string;
  userEmail: string;
}): Promise<{ success: boolean; message: string }> {
  // 1. Update local registry
  const registry = getLocalDeletionRegistry();
  if (registry[params.userId]) {
    delete registry[params.userId];
    saveLocalDeletionRegistry(registry);
  }

  // 2. Update Supabase Auth user metadata
  try {
    await supabase.auth.updateUser({
      data: {
        deletion_requested_at: null,
        deletion_scheduled_at: null,
        deletion_status: 'cancelled',
      },
    });
  } catch (authErr) {
    console.warn('Auth metadata update notice:', authErr);
  }

  // 3. Update profiles table
  try {
    await supabase.from('profiles').update({
      deletion_requested_at: null,
      deletion_scheduled_at: null,
      deletion_status: null,
      deletion_reason: null,
    }).eq('id', params.userId);
  } catch (dbErr) {
    console.warn('Profiles table notice:', dbErr);
  }

  // 4. In-App notification
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      title: '🛡️ Account Deletion Request Cancelled',
      message: 'Your account deletion request has been successfully cancelled. Your CityZen civic account remains active with full privileges.',
      type: 'government',
      read: false,
    });
  } catch (e) {
    console.warn(e);
  }

  // 5. Send automated confirmation email
  if (params.userEmail) {
    sendAutomatedCitizenNoticeEmail({
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      title: 'Account Deletion Cancelled',
      subject: '[CONFIRMED] CityZen Account Deletion Cancelled',
      message: `Dear ${params.userName || 'Citizen'},\n\nYour account deletion request on the CityZen portal has been cancelled. Your account remains active and no data will be deleted.\n\nCityZen Security Directorate`,
      category: 'government',
    }).catch(e => console.warn(e));
  }

  return {
    success: true,
    message: 'Account deletion cancelled successfully. Your account is fully active.',
  };
}

/**
 * Admin: Modify scheduled deletion timing for any user (extend, expedite, or reschedule)
 */
export async function adminModifyDeletionTiming(params: {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  newScheduledAt: string;
}): Promise<{ success: boolean; message: string }> {
  const registry = getLocalDeletionRegistry();
  const current = registry[params.targetUserId] || {
    userId: params.targetUserId,
    userName: params.targetUserName,
    userEmail: params.targetUserEmail,
    requestedAt: new Date().toISOString(),
    scheduledAt: params.newScheduledAt,
    status: 'scheduled',
  };

  current.scheduledAt = params.newScheduledAt;
  current.modifiedByAdmin = true;
  current.status = 'scheduled';
  registry[params.targetUserId] = current;
  saveLocalDeletionRegistry(registry);

  // Update profiles table
  try {
    await supabase.from('profiles').update({
      deletion_scheduled_at: params.newScheduledAt,
      deletion_status: 'scheduled',
    }).eq('id', params.targetUserId);
  } catch (dbErr) {
    console.warn('DB update notice:', dbErr);
  }

  const formattedNewDate = new Date(params.newScheduledAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Notify citizen of the modified timeline
  try {
    await supabase.from('notifications').insert({
      user_id: params.targetUserId,
      title: '⏱️ Account Deletion Timeline Updated by Administration',
      message: `The scheduled deletion timeline for your account has been updated by the Municipal Administration. Your account is now scheduled for permanent removal on ${formattedNewDate}.`,
      type: 'government',
      read: false,
    });
  } catch (e) {
    console.warn(e);
  }

  if (params.targetUserEmail) {
    sendAutomatedCitizenNoticeEmail({
      userId: params.targetUserId,
      userEmail: params.targetUserEmail,
      userName: params.targetUserName,
      title: 'Account Deletion Timeline Updated',
      subject: '[ADMIN NOTICE] CityZen Deletion Schedule Modified',
      message: `Dear ${params.targetUserName || 'Citizen'},\n\nYour account deletion timeline has been modified by the Municipal Administrator.\n\nNew Scheduled Execution Time: ${formattedNewDate}\n\nCityZen Municipal Administration`,
      category: 'government',
    }).catch(e => console.warn(e));
  }

  return {
    success: true,
    message: `Deletion timeline successfully rescheduled to ${formattedNewDate}`,
  };
}

/**
 * Admin: Immediately delete any user account (bypasses 3-day restriction and 7-day wait)
 */
export async function adminImmediateDeleteUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: targetUserId });
  if (error) {
    throw error;
  }

  // Remove from registry
  const registry = getLocalDeletionRegistry();
  delete registry[targetUserId];
  saveLocalDeletionRegistry(registry);

  return {
    success: true,
    message: 'User account permanently erased immediately by Super Administrator override.',
  };
}
