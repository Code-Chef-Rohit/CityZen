import type { Notification, Bill, Complaint, EmergencyRequest } from './types';
import { supabase } from './supabase';

/**
 * ============================================================================
 * CITYZEN SCREEN DATA IN-MEMORY SWR CACHE
 * Eliminates skeleton flashes and provides 0ms instant transitions when
 * switching between Home, Alerts, Complaints, Bills, and Emergency.
 * ============================================================================
 */

interface ScreenCacheState {
  notifications: { data: Notification[]; userId: string } | null;
  home: {
    bills: Bill[];
    complaints: Complaint[];
    notifications: Notification[];
    userId: string;
  } | null;
  complaints: { data: Complaint[]; userId: string } | null;
  bills: { data: Bill[]; userId: string } | null;
  emergency: { data: EmergencyRequest[]; userId: string } | null;
}

const memoryCache: ScreenCacheState = {
  notifications: null,
  home: null,
  complaints: null,
  bills: null,
  emergency: null,
};

// ----------------------------------------------------------------------------
// 1. NOTIFICATIONS (ALERTS) CACHE
// ----------------------------------------------------------------------------
export const getCachedNotifications = (userId?: string): Notification[] | null => {
  if (!userId || !memoryCache.notifications || memoryCache.notifications.userId !== userId) {
    return null;
  }
  return memoryCache.notifications.data;
};

export const setCachedNotifications = (data: Notification[], userId: string) => {
  memoryCache.notifications = { data: [...data], userId };
  // Keep home alerts in sync if present
  if (memoryCache.home && memoryCache.home.userId === userId) {
    memoryCache.home.notifications = data.slice(0, 3);
  }
};

// ----------------------------------------------------------------------------
// 2. HOME SCREEN COMPOSITE CACHE
// ----------------------------------------------------------------------------
export const getCachedHome = (userId?: string) => {
  if (!userId || !memoryCache.home || memoryCache.home.userId !== userId) {
    return null;
  }
  return memoryCache.home;
};

export const setCachedHome = (
  data: { bills: Bill[]; complaints: Complaint[]; notifications: Notification[] },
  userId: string
) => {
  memoryCache.home = {
    bills: [...data.bills],
    complaints: [...data.complaints],
    notifications: [...data.notifications],
    userId,
  };
};

// ----------------------------------------------------------------------------
// 3. COMPLAINTS CACHE
// ----------------------------------------------------------------------------
export const getCachedComplaints = (userId?: string): Complaint[] | null => {
  if (!memoryCache.complaints) return null;
  return memoryCache.complaints.data;
};

export const setCachedComplaints = (data: Complaint[], userId: string) => {
  memoryCache.complaints = { data: [...data], userId };
  if (memoryCache.home && memoryCache.home.userId === userId) {
    memoryCache.home.complaints = data.slice(0, 3);
  }
};

// ----------------------------------------------------------------------------
// 4. BILLS CACHE
// ----------------------------------------------------------------------------
export const getCachedBills = (userId?: string): Bill[] | null => {
  if (!userId || !memoryCache.bills || memoryCache.bills.userId !== userId) {
    return null;
  }
  return memoryCache.bills.data;
};

export const setCachedBills = (data: Bill[], userId: string) => {
  memoryCache.bills = { data: [...data], userId };
  if (memoryCache.home && memoryCache.home.userId === userId) {
    memoryCache.home.bills = data.filter((b) => b.status === 'unpaid').slice(0, 3);
  }
};

// ----------------------------------------------------------------------------
// 5. EMERGENCY REQUESTS CACHE
// ----------------------------------------------------------------------------
export const getCachedEmergency = (userId?: string): EmergencyRequest[] | null => {
  if (!userId || !memoryCache.emergency || memoryCache.emergency.userId !== userId) {
    return null;
  }
  return memoryCache.emergency.data;
};

export const setCachedEmergency = (data: EmergencyRequest[], userId: string) => {
  memoryCache.emergency = { data: [...data], userId };
};

// ----------------------------------------------------------------------------
// 6. BACKGROUND PRE-WARM ENGINE
// Runs in background upon citizen session verification so opening any tab is 0ms
// ----------------------------------------------------------------------------
export const preloadCitizenData = async (userId: string) => {
  if (!userId) return;
  try {
    const [notifRes, billsRes, complaintsRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('bills')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true }),
      supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (notifRes.data) {
      setCachedNotifications(notifRes.data, userId);
    }
    if (billsRes.data) {
      setCachedBills(billsRes.data, userId);
    }
    if (complaintsRes.data) {
      setCachedComplaints(complaintsRes.data, userId);
    }
    if (billsRes.data && complaintsRes.data && notifRes.data) {
      setCachedHome(
        {
          bills: (billsRes.data as Bill[]).filter((b: Bill) => b.status === 'unpaid').slice(0, 3),
          complaints: complaintsRes.data.slice(0, 3),
          notifications: notifRes.data.slice(0, 3),
        },
        userId
      );
    }
  } catch (err) {
    console.debug('Background cache pre-warm notice:', err);
  }
};
