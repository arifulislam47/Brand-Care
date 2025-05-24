'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from 'next/navigation';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: Timestamp;
  inTime: Timestamp | null;
  outTime: Timestamp | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  overtime: number;
}

export default function MyAttendancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchAttendanceRecords = async () => {
      try {
        setLoading(true);
        
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);

        const attendanceRef = collection(db, 'attendance');
        const q = query(
          attendanceRef,
          where('userId', '==', user.uid),
          where('date', '>=', Timestamp.fromDate(start)),
          where('date', '<=', Timestamp.fromDate(end)),
          orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AttendanceRecord[];

        setAttendanceRecords(records);
        setIsCreatingIndex(false);
      } catch (error: any) {
        console.error('Error fetching attendance records:', error);
        
        // If the error is about missing index, set the isCreatingIndex state
        if (error?.message?.includes('index')) {
          setIsCreatingIndex(true);
          // Try again after a short delay to allow index creation
          setTimeout(() => {
            fetchAttendanceRecords();
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceRecords();
  }, [user, selectedMonth, router]);

  const calculateDuration = (inTime: Timestamp | null, outTime: Timestamp | null): string => {
    if (!inTime || !outTime) return '-';
    const minutes = Math.floor((outTime.toDate().getTime() - inTime.toDate().getTime()) / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getStatusBadgeClass = (status: 'PRESENT' | 'LATE' | 'ABSENT'): string => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800';
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800';
      case 'ABSENT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || isCreatingIndex) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">
          {isCreatingIndex ? 'Setting up...' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">My Attendance Records</h2>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Month
            </label>
            <DatePicker
              selected={selectedMonth}
              onChange={(date: Date | null) => date && setSelectedMonth(date)}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check In
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check Out
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overtime
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No attendance records found for {format(selectedMonth, 'MMMM yyyy')}
                  </td>
                </tr>
              ) : (
                attendanceRecords.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(record.date.toDate(), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.inTime ? format(record.inTime.toDate(), 'hh:mm a') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.outTime ? format(record.outTime.toDate(), 'hh:mm a') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {calculateDuration(record.inTime, record.outTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.overtime > 0 ? `${record.overtime.toFixed(2)}h` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            <p>Total Records: {attendanceRecords.length}</p>
            <p>Present: {attendanceRecords.filter(r => r.status === 'PRESENT').length}</p>
            <p>Late: {attendanceRecords.filter(r => r.status === 'LATE').length}</p>
            <p>Absent: {attendanceRecords.filter(r => r.status === 'ABSENT').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 