'use client';

import { useState } from 'react';
import SimpleCalendar from '../../../components/Calendar';
import SimpleDayModal from '../../../components/DayDetailModal';
import PcoDashboardLayout from '../../../components/PcoDashboardLayout';

interface Report {
  id: number;
  client_name: string;
  report_type: string;
  status: string;
}

export default function PcoCalendarPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedReports, setSelectedReports] = useState<Report[]>([]);

  const handleDayClick = (date: string, reports: Report[]) => {
    setSelectedDate(date);
    setSelectedReports(reports);
    setModalOpen(true);
  };

  // Get user info from localStorage (same as other PCO pages)
  const userData = typeof window !== 'undefined' ? localStorage.getItem('kps_user') : null;
  const user = userData ? JSON.parse(userData) : null;

  return (
    <PcoDashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Calendar</h1>
          <p className="text-gray-600">
            View your scheduled jobs and completed work history
          </p>
        </div>

        {user && (
          <SimpleCalendar
            pcoId={user.id}
            onDayClick={handleDayClick}
            className="mb-6"
          />
        )}

        <SimpleDayModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          date={selectedDate}
          reports={selectedReports}
        />
      </div>
    </PcoDashboardLayout>
  );
}