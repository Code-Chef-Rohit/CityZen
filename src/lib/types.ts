export type Role = 'citizen' | 'business' | 'admin';
export type Language = 'en' | 'hi' | 'ta' | 'te' | 'mr' | 'bn';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  language: Language;
  ward: number | null;
  avatar_url: string | null;
  blocked?: boolean;
  email?: string;
  created_at: string;
}

export type ComplaintCategory = 'water' | 'electricity' | 'waste' | 'roads' | 'streetlight' | 'other';
export type ComplaintStatus = 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export interface Complaint {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: ComplaintCategory;
  status: ComplaintStatus;
  department: string | null;
  location_text: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type BillType = 'water' | 'electricity' | 'property' | 'waste';
export type BillStatus = 'unpaid' | 'paid';

export interface Bill {
  id: string;
  user_id: string;
  type: BillType;
  amount: number;
  due_date: string | null;
  period: string | null;
  status: BillStatus;
  paid_at: string | null;
  created_at: string;
}

export type EmergencyType = 'police' | 'ambulance' | 'fire' | 'disaster';
export type EmergencyStatus = 'active' | 'dispatched' | 'resolved';

export interface EmergencyRequest {
  id: string;
  user_id: string;
  type: EmergencyType;
  status: EmergencyStatus;
  location_text: string | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type NotificationType = 'emergency' | 'government' | 'bill' | 'complaint' | 'traffic' | 'ai';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  category: string;
  name: string;
  description: string | null;
  icon: string;
  available: boolean;
}

export type MapCategory = 'hospital' | 'police' | 'fire' | 'parking' | 'government' | 'pharmacy' | 'park' | 'transit';

export interface MapPoint {
  id: string;
  name: string;
  category: MapCategory;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  open_24h: boolean;
}

export type EnvMetric = 'aqi' | 'temperature' | 'co2' | 'noise' | 'water_quality' | 'green_coverage';

export interface EnvReading {
  id: string;
  metric: EnvMetric;
  value: number;
  unit: string;
  recorded_at: string;
}
