'use client';

import { create } from 'zustand';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
}

interface DeviceStore extends DeviceInfo {
  initialized: boolean;
  setDeviceInfo: (info: Partial<DeviceInfo>) => void;
  initializeDevice: () => void;
}

export const useDeviceStore = create<DeviceStore>((set: any) => ({
  // Default values (server-side safe)
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  screenWidth: 1024,
  initialized: false,

  setDeviceInfo: (info: any) => set((state: any) => ({ ...state, ...info })),

  initializeDevice: () => {
    if (typeof window === 'undefined') return;

    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      set({
        isMobile: width < 1024, // Using lg breakpoint (1024px)
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        isTouchDevice,
        screenWidth: width,
        initialized: true,
      });
    };

    // Initial check
    updateDeviceInfo();

    // Listen for resize events
    const handleResize = () => {
      updateDeviceInfo();
    };

    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  },
}));
