/**
 * Simple Calendar Component - Production Ready
 * Displays PCO job history in a monthly calendar view
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { buildApiUrl } from '@/lib/api';

interface CalendarReport {
  id: number;
  client_name: string;
  report_type: string;
  status: string;
}

interface CalendarDay {
  count: number;
  reports: CalendarReport[];
}

interface CalendarData {
  pco: {
    id: number;
    name: string;
  };
  year: number;
  month: number;
  calendar: Record<string, CalendarDay>;
}

interface SimpleCalendarProps {
  pcoId: number;
  onDayClick?: (date: string, reports: CalendarReport[]) => void;
  className?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SimpleCalendar({ pcoId, onDayClick, className = '' }: SimpleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchCalendarData();
  }, [pcoId, year, month]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('kps_token');
      if (!token) {
        setError('Please log in to view calendar');
        return;
      }

      // Use buildApiUrl like the rest of the app
      const response = await fetch(
        buildApiUrl(`/api/calendar/pco/${pcoId}/calendar/${year}/${month}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Please log in again' : 'Failed to load calendar');
      }

      const data = await response.json();
      setCalendarData(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Empty cells for days before month start
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    // Fill out the grid to 42 cells (6 weeks) with trailing empty cells
    const totalCells = 42;
    while (days.length < totalCells) {
      days.push(null);
    }

    return days;
  };

  const formatDate = (day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDayData = (day: number) => {
    const date = formatDate(day);
    return calendarData?.calendar[date] || null;
  };

  const handleDayClick = async (day: number) => {
    const dayData = getDayData(day);
    
    if (dayData && dayData.count > 0 && onDayClick) {
      const dateStr = formatDate(day);
      
      try {
        const token = localStorage.getItem('kps_token');
        const response = await fetch(
          buildApiUrl(`/api/calendar/pco/${pcoId}/calendar/day/${dateStr}`),
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const dayDetailData = await response.json();
          
          if (dayDetailData.success) {
            onDayClick(dateStr, dayDetailData.data.reports || []);
          } else {
            onDayClick(dateStr, []);
          }
        } else {
          console.error('Failed to fetch day details:', response.status);
          onDayClick(dateStr, []);
        }
      } catch (error) {
        console.error('Error fetching day details:', error);
        onDayClick(dateStr, []);
      }
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center py-8">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">{error}</p>
          <button
            onClick={fetchCalendarData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const days = getDaysInMonth();

  return (
    <div className={`bg-white rounded-lg shadow-sm h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2 flex-shrink-0">
          {DAYS.map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const uniqueKey = day ? `${year}-${month}-${day}` : `empty-${year}-${month}-${index}`;
              
              if (day === null) {
                return <div key={uniqueKey} className="p-2 h-[60px]"></div>;
              }

              const dayData = getDayData(day);
              const hasWork = dayData && dayData.count > 0;
              
              // Check if this is today
              const today = new Date();
              const isToday = today.getFullYear() === year && 
                             today.getMonth() === month - 1 && 
                             today.getDate() === day;

              return (
                <button
                  key={uniqueKey}
                  onClick={() => handleDayClick(day)}
                  disabled={!hasWork}
                  className={`
                    p-2 h-[60px] text-sm rounded transition-colors flex flex-col relative
                    ${isToday 
                      ? hasWork
                        ? 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
                        : 'bg-purple-50 hover:bg-purple-100 border border-purple-200'
                      : hasWork 
                        ? 'bg-blue-100 hover:bg-blue-200 border border-blue-200' 
                        : 'hover:bg-gray-50 border border-transparent'
                    }
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`${isToday ? 'font-bold text-black' : 'font-medium text-gray-600'}`}>
                      {day}
                    </span>
                    {hasWork && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 mt-1 min-w-[20px] ${
                        isToday 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-blue-600 text-white'
                      }`}>
                        {dayData.count}
                      </span>
                    )}
                    {isToday && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleCalendar;