'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EditReportRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new page with reportId as query param
    if (params.id) {
      router.replace(`/pco/report/new?reportId=${params.id}`);
    }
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  );
}
