'use client';

import { useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';

export default function DeviceDetection() {
  const initializeDevice = useDeviceStore((state: any) => state.initializeDevice);

  useEffect(() => {
    const cleanup = initializeDevice();
    return cleanup;
  }, [initializeDevice]);

  return null;
}
