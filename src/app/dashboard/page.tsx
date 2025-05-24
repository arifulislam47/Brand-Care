'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, addDoc, Timestamp, orderBy, updateDoc, doc } from 'firebase/firestore';
import { format, isToday, setHours, setMinutes, differenceInMinutes, isBefore, isAfter, startOfMonth } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<Timestamp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Constants for time rules
  const WORKDAY_START = setHours(setMinutes(new Date(), 0), 10); // 10:00 AM
  const LATE_THRESHOLD = setHours(setMinutes(new Date(), 15), 10); // 10:15 AM
  const ABSENT_THRESHOLD = setHours(setMinutes(new Date(), 0), 11); // 11:00 AM
  const WORK_HOURS = 8; // 8 hours standard work day

  useEffect(() => {
    if (!user) return;

    const checkTodayAttendance = async () => {
      try {
        setLoading(true);
        setError(null);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendanceRef = collection(db, 'attendance');
        const q = query(
          attendanceRef,
          where('userId', '==', user.uid),
          where('date', '>=', Timestamp.fromDate(today)),
          orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const todayRecord = querySnapshot.docs.find(doc => 
          isToday(doc.data().date.toDate())
        );

        if (todayRecord) {
          const recordData = todayRecord.data();
          
          if (recordData.outTime) {
            setHasCheckedInToday(false);
            setHasCheckedOutToday(true);
            setLastCheckIn(null);
            setError('You have completed your attendance for today');
            return;
          }

          if (recordData.inTime) {
            setHasCheckedInToday(true);
            setHasCheckedOutToday(false);
            setLastCheckIn(recordData.inTime);

            const checkInTime = recordData.inTime.toDate();
            if (recordData.status === 'ABSENT' || isAfter(checkInTime, ABSENT_THRESHOLD)) {
              setError('Checked in after 11:00 AM. This will be marked as absent.');
            } else if (recordData.status === 'LATE' || isAfter(checkInTime, LATE_THRESHOLD)) {
              setError('Checked in late. This will be marked as late attendance.');
            } else {
              setError(null);
            }
            return;
          }
        }
        
        setHasCheckedInToday(false);
        setHasCheckedOutToday(false);
        setLastCheckIn(null);
        setError(null);
        
      } catch (error: any) {
        console.error('Error checking attendance:', error);
        if (error.message?.includes('requires an index')) {
          setError('System is updating. Please try again in a few minutes.');
        } else {
          setError('Unable to check attendance status. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    checkTodayAttendance();
    const interval = setInterval(checkTodayAttendance, 60000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchAttendanceRecords = async () => {
      try {
        setLoadingRecords(true);
        const startDate = startOfMonth(new Date()); // Get records from start of current month
        
        const attendanceRef = collection(db, 'attendance');
        const q = query(
          attendanceRef,
          where('userId', '==', user.uid),
          where('date', '>=', Timestamp.fromDate(startDate)),
          orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAttendanceRecords(records);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchAttendanceRecords();
  }, [user, hasCheckedInToday, hasCheckedOutToday]); // Refresh when check-in/out status changes

  const handleCheckIn = async () => {
    if (!user || isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);
      const now = new Date();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(today))
      );
      
      const querySnapshot = await getDocs(q);
      const todayRecord = querySnapshot.docs.find(doc => 
        isToday(doc.data().date.toDate())
      );

      if (todayRecord) {
        setError('You have already checked in today');
        return;
      }

      let status = 'PRESENT';
      if (isAfter(now, ABSENT_THRESHOLD)) {
        status = 'ABSENT';
      } else if (isAfter(now, LATE_THRESHOLD)) {
        status = 'LATE';
      }

      const attendanceData = {
        userId: user.uid,
        date: Timestamp.fromDate(today),
        inTime: Timestamp.fromDate(now),
        outTime: null,
        status: status,
        overtime: 0,
      };

      await addDoc(collection(db, 'attendance'), attendanceData);
      setHasCheckedInToday(true);
      setHasCheckedOutToday(false);
      setLastCheckIn(Timestamp.fromDate(now));
      
      if (status === 'LATE') {
        setError('Checked in late. This will be marked as late attendance.');
      } else if (status === 'ABSENT') {
        setError('Checked in after 11:00 AM. This will be marked as absent.');
      } else {
        setError('Successfully checked in!');
      }
    } catch (error: any) {
      console.error('Error checking in:', error);
      if (error.message?.includes('requires an index')) {
        setError('System is updating. Please try again in a few minutes.');
      } else {
        setError(`Unable to check in: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);
      const now = new Date();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(today))
      );
      
      const querySnapshot = await getDocs(q);
      const todayRecord = querySnapshot.docs.find(doc => 
        isToday(doc.data().date.toDate())
      );

      if (!todayRecord) {
        setError('No check-in record found for today');
        return;
      }

      const recordData = todayRecord.data();

      if (recordData.outTime) {
        setError('You have already checked out today');
        return;
      }

      const checkInTime = recordData.inTime.toDate();
      const totalWorkMinutes = differenceInMinutes(now, checkInTime);
      const standardWorkMinutes = WORK_HOURS * 60;
      const overtimeMinutes = Math.max(0, totalWorkMinutes - standardWorkMinutes);
      const overtimeHours = Math.round(overtimeMinutes / 60 * 100) / 100;

      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        outTime: Timestamp.fromDate(now),
        overtime: overtimeHours
      });

      setHasCheckedInToday(false);
      setHasCheckedOutToday(true);
      setLastCheckIn(null);
      setError('Successfully checked out!');
      
    } catch (error: any) {
      console.error('Error checking out:', error);
      if (error.message?.includes('requires an index')) {
        setError('System is updating. Please try again in a few minutes.');
      } else {
        setError('Unable to check out. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <p className="text-gray-600 text-center px-4">Please log in to access the attendance system.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-6 sm:py-8 lg:py-12">
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        <div className="mb-10 md:mb-16">
          <h2 className="mb-4 text-2xl font-bold text-gray-800 md:mb-6 lg:text-3xl">
            Attendance Dashboard
          </h2>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <div className="rounded-lg bg-white p-4 md:p-8 shadow-lg">
            {error && (
              <div className={`mb-6 p-4 border rounded-lg ${
                error.includes('Successfully') 
                  ? 'bg-green-100 border-green-400 text-green-700'
                  : error.includes('marked as absent') || error.includes('late')
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : error.includes('completed your attendance')
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-red-100 border-red-400 text-red-700'
              }`}>
                <p className="text-sm md:text-base">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <div className="text-gray-600">
                {lastCheckIn ? (
                  <div className="space-y-2">
                    <p className="text-base md:text-lg">
                      Last check-in: {format(lastCheckIn.toDate(), 'h:mm a')}
                    </p>
                    {hasCheckedInToday && (
                      <p className="text-green-600 font-medium text-sm md:text-base">
                        You are currently checked in
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm md:text-base">No check-in recorded for today</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={handleCheckIn}
                  disabled={hasCheckedInToday || hasCheckedOutToday || loading || isProcessing}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm md:text-base font-medium ${
                    hasCheckedInToday || hasCheckedOutToday || isProcessing
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 min-w-[120px] justify-center items-center inline-flex`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Check In'
                  )}
                </button>

                <button
                  onClick={handleCheckOut}
                  disabled={!hasCheckedInToday || loading || isProcessing}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm md:text-base font-medium ${
                    !hasCheckedInToday || isProcessing
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
                  } text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 min-w-[120px] justify-center items-center inline-flex`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Check Out'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Attendance Records Section */}
          <div className="rounded-lg bg-white p-4 md:p-8 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Recent Attendance Records</h3>
            
            {loadingRecords ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : attendanceRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {format(record.date.toDate(), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {format(record.inTime.toDate(), 'h:mm a')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {record.outTime ? format(record.outTime.toDate(), 'h:mm a') : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'LATE'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {record.overtime > 0 ? `${record.overtime}h` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No attendance records found for this month.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 