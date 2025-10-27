'use client';

import Image from 'next/image';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

export default function Loading({ 
  size = 'md', 
  text,
  fullScreen = false 
}: LoadingProps) {
  const sizeMap = {
    sm: 40,
    md: 60,
    lg: 80,
    xl: 120
  };

  const imageSizeMap = {
    sm: 'w-10 h-10',
    md: 'w-15 h-15',
    lg: 'w-20 h-20',
    xl: 'w-30 h-30'
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${imageSizeMap[size]} relative`}>
        <Image
          src="/Loading Bloob.gif"
          alt="Loading..."
          width={sizeMap[size]}
          height={sizeMap[size]}
          unoptimized
          priority
        />
      </div>
      {text && (
        <p className="text-gray-600 text-sm font-medium animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
