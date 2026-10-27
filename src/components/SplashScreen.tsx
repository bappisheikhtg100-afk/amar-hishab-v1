import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as CapSplashScreen } from '@capacitor/splash-screen';
import { APP_ICON_DATA_URI } from '../utils/appIconData';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void CapSplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
    }

    const fadeTimer = window.setTimeout(() => setFading(true), 850);
    const doneTimer = window.setTimeout(() => onComplete(), 1100);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6 select-none transition-opacity duration-250 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        {/* Centered 1024x1024 Brand Icon */}
        <div className="w-24 h-24 rounded-[26px] shadow-[0_20px_44px_-12px_rgba(5,150,105,0.28)] ring-1 ring-slate-900/[0.04] overflow-hidden bg-white">
          <img
            src={APP_ICON_DATA_URI}
            alt="আমার হিসাব"
            className="w-full h-full object-cover"
          />
        </div>

        {/* App Name & Tagline Directly Underneath */}
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          আমার হিসাব
        </h1>
        <p className="mt-1.5 text-[13px] font-medium text-slate-400 tracking-wide">
          সহজ হিসাব, নিজের নিয়ন্ত্রণে
        </p>
      </div>
    </div>
  );
}
