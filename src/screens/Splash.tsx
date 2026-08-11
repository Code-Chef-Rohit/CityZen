import { useEffect, useState } from 'react';
import { Building2, Leaf, Droplets, Zap, Bus, Shield } from 'lucide-react';

export function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 300);
          return 100;
        }
        return p + 4;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [onDone]);

  const orbitIcons = [
    { Icon: Leaf, color: 'text-primary-500', delay: '0s' },
    { Icon: Droplets, color: 'text-secondary-500', delay: '0.5s' },
    { Icon: Zap, color: 'text-accent-500', delay: '1s' },
    { Icon: Bus, color: 'text-secondary-600', delay: '1.5s' },
    { Icon: Shield, color: 'text-primary-600', delay: '2s' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-20 right-10 w-52 h-52 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-28 h-28 mb-8">
          <div className="absolute inset-0 bg-slate-950/40 rounded-3xl border border-white/20 shadow-2xl overflow-hidden backdrop-blur-md flex items-center justify-center animate-float">
            <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
          </div>
          {orbitIcons.map(({ Icon, color, delay }, i) => {
            const angle = (i / orbitIcons.length) * Math.PI * 2;
            const radius = 72;
            return (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-8 h-8 -ml-4 -mt-4"
                style={{
                  transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                  animation: `float 3s ease-in-out infinite`,
                  animationDelay: delay,
                }}
              >
                <div className="w-8 h-8 rounded-xl bg-white/90 shadow-lg flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
            );
          })}
        </div>

        <h1 className="text-4xl font-extrabold text-white tracking-tight">CITY ZEN</h1>
        <p className="text-primary-100 text-sm font-medium mt-2 tracking-wide">One City. One App.</p>
      </div>

      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-3">
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-primary-100/70 text-xs">Loading your city…</p>
      </div>
    </div>
  );
}
