'use client';

import { forwardRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SignatureCanvas to avoid SSR issues
// Cast to any to bypass TypeScript ref limitation with dynamic imports
const SignatureCanvasLib = dynamic(() => import('react-signature-canvas'), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-gray-100 rounded-xl animate-pulse" />
}) as any;

interface SignatureCanvasProps {
  onEnd?: () => void;
  canvasProps?: {
    className?: string;
    style?: React.CSSProperties;
  };
  backgroundColor?: string;
  penColor?: string;
}

// Wrapper component to handle ref forwarding
const SignatureCanvasWrapper = forwardRef<any, SignatureCanvasProps>((props, ref) => {
  return <SignatureCanvasLib {...props} ref={ref} />;
});

SignatureCanvasWrapper.displayName = 'SignatureCanvas';

export default SignatureCanvasWrapper;
