import {
  Droplets, Zap, Trash2, Bus, SquareParking, Car, Building2, Pill, HeartPulse,
  FileText, ScrollText, Landmark, HardHat, Home, Siren, Shield, Leaf,
  MessageSquareWarning, type LucideIcon,
} from 'lucide-react';

export const iconMap: Record<string, LucideIcon> = {
  Droplets, Zap, Trash2, Bus, SquareParking, Car, Building2, Pill, HeartPulse,
  FileText, ScrollText, Landmark, HardHat, Home, Siren, Shield, Leaf,
  MessageSquareWarning,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? MessageSquareWarning;
  return <Icon className={className} />;
}
