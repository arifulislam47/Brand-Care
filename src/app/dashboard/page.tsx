'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { exportedDb as firebaseDb } from '@/lib/firebase';
import { collection, query, getDocs, where, addDoc, Timestamp, orderBy, updateDoc, doc } from 'firebase/firestore';
import { format, isToday, setHours, setMinutes, differenceInMinutes, isAfter } from 'date-fns';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: Timestamp;
  inTime: Timestamp;
  outTime: Timestamp | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  overtime: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<Timestamp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  
  // Initialize interval ref with undefined
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Memoize time constants to prevent recalculation
  const timeConstants = useMemo(() => {
    const now = new Date();
    return {
      WORKDAY_START: setHours(setMinutes(new Date(now), 0), 10),
      LATE_THRESHOLD: setHours(setMinutes(new Date(now), 15), 10),
      ABSENT_THRESHOLD: setHours(setMinutes(new Date(now), 0), 11),
      WORK_HOURS: 8
    };
  }, []); // Empty deps since these are constant

  const { WORKDAY_START, LATE_THRESHOLD, ABSENT_THRESHOLD, WORK_HOURS } = timeConstants;

  // Add ref to track initial mount
  const isInitialMount = useRef(true);
  const prevState = useRef({
    hasCheckedInToday: false,
    hasCheckedOutToday: false,
    loading: false,
    isProcessing: false
  });

  // Single debug effect that only runs on mount and state changes
  useEffect(() => {
    if (isInitialMount.current) {
      console.log('Debug - Initial Component State:', {
        user: user?.uid,
        hasCheckedInToday,
        hasCheckedOutToday,
        loading,
        isProcessing,
        error,
        firebaseDb: !!firebaseDb,
        isFirebaseReady
      });
      isInitialMount.current = false;
      return;
    }

    // Only log if relevant states have changed
    if (prevState.current.hasCheckedInToday !== hasCheckedInToday ||
        prevState.current.hasCheckedOutToday !== hasCheckedOutToday ||
        prevState.current.loading !== loading ||
        prevState.current.isProcessing !== isProcessing) {
      
      console.log('Debug - State Changed:', {
        hasCheckedInToday,
        hasCheckedOutToday,
        loading,
        isProcessing,
        error
      });

      // Update previous state
      prevState.current = {
        hasCheckedInToday,
        hasCheckedOutToday,
        loading,
        isProcessing
      };
    }
  }, [user?.uid, hasCheckedInToday, hasCheckedOutToday, loading, isProcessing, error, isFirebaseReady]);

  // Single effect for Firebase initialization
  useEffect(() => {
    if (!firebaseDb) return;
    
    // One-time initialization
    setIsFirebaseReady(true);
    checkTodayAttendance();
  }, [firebaseDb]); // Only run when Firebase is available

  // Combine attendance check and interval into one effect
  useEffect(() => {
    if (!isFirebaseReady || !user) return;

    // Set up interval only if needed
    let interval: NodeJS.Timeout | undefined;
    
    if (!hasCheckedOutToday && !hasCheckedInToday) {
      interval = setInterval(() => {
        checkTodayAttendance();
      }, 300000); // 5 minutes
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isFirebaseReady, user, hasCheckedOutToday, hasCheckedInToday]);

  // Memoize the records fetch callback
  const fetchAttendanceRecords = useCallback(async () => {
    if (!user || !firebaseDb || !isFirebaseReady) return;

    try {
      setLoadingRecords(true);
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      
      const attendanceRef = collection(firebaseDb, 'attendance');
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
      })) as AttendanceRecord[];

      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoadingRecords(false);
    }
  }, [user?.uid, firebaseDb, isFirebaseReady]);

  // Fetch records only when needed
  useEffect(() => {
    if (attendanceRecords.length === 0 || hasCheckedInToday || hasCheckedOutToday) {
      fetchAttendanceRecords();
    }
  }, [hasCheckedInToday, hasCheckedOutToday]);

  const checkTodayAttendance = useCallback(async () => {
    if (!user || !firebaseDb || loading) return;

    try {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendanceRef = collection(firebaseDb, 'attendance');
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
      
    } catch (error) {
      console.error('Error checking attendance:', error);
      setError('Unable to check attendance status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, firebaseDb, loading, LATE_THRESHOLD, ABSENT_THRESHOLD]);

  const handleCheckIn = async () => {
    console.log('Debug - Check-in button clicked');
    
    // Reset any previous errors
    setError(null);

    // Basic validation checks
    if (!user) {
      console.log('Debug - No user found');
      setError('Please log in to check in.');
      return;
    }

    if (!firebaseDb) {
      console.log('Debug - Firebase DB not initialized');
      setError('System is not ready. Please refresh the page and try again.');
      return;
    }

    if (isProcessing) {
      console.log('Debug - Already processing');
      setError('Please wait, processing previous request...');
      return;
    }

    try {
      console.log('Debug - Starting check-in process');
      setIsProcessing(true);

      // Get current time
      const now = new Date();
      console.log('Debug - Current time:', now.toLocaleString());

      // Set today to midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('Debug - Today at midnight:', today.toLocaleString());

      // Create simple attendance record
      const attendanceData = {
        userId: user.uid,
        date: Timestamp.fromDate(today),
        inTime: Timestamp.fromDate(now),
        outTime: null,
        status: isAfter(now, ABSENT_THRESHOLD) ? 'ABSENT' : 
                isAfter(now, LATE_THRESHOLD) ? 'LATE' : 'PRESENT',
        overtime: 0,
      };

      console.log('Debug - Attendance data:', attendanceData);

      // Add the record
      const docRef = await addDoc(collection(firebaseDb, 'attendance'), attendanceData);
      console.log('Debug - Added attendance record with ID:', docRef.id);

      // Update UI state
      setHasCheckedInToday(true);
      setLastCheckIn(Timestamp.fromDate(now));
      
      // Set appropriate message
      if (attendanceData.status === 'LATE') {
        setError('Checked in late. This will be marked as late attendance.');
      } else if (attendanceData.status === 'ABSENT') {
        setError('Checked in after 11:00 AM. This will be marked as absent.');
      } else {
        setError('Successfully checked in!');
      }

      // Refresh the records
      await fetchAttendanceRecords();

    } catch (error: any) {
      console.error('Debug - Check-in error:', error);
      
      // Handle specific Firebase errors
      if (error?.code === 'permission-denied') {
        setError('You do not have permission to check in. Please contact your administrator.');
      } else if (error?.code === 'unavailable') {
        setError('Service is currently unavailable. Please try again later.');
      } else if (error?.message?.includes('requires an index')) {
        setError('System is updating. Please try again in a few minutes.');
      } else {
        setError('Unable to check in. Please try again. If the problem persists, contact support.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify the button render to be more informative
  const renderCheckInButton = () => {
    const buttonText = isProcessing ? 'Processing...' : 'Check In';
    const isDisabled = hasCheckedInToday || hasCheckedOutToday || isProcessing;
    const buttonClass = `flex-1 px-4 py-2.5 rounded-lg text-sm md:text-base font-medium ${
      isDisabled
        ? 'bg-gray-300 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
    } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 min-w-[120px] justify-center items-center inline-flex`;

    return (
      <button
        onClick={handleCheckIn}
        disabled={isDisabled}
        className={buttonClass}
        title={
          hasCheckedInToday ? 'Already checked in' :
          hasCheckedOutToday ? 'Already checked out' :
          isProcessing ? 'Processing...' :
          'Click to check in'
        }
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            <span>Processing...</span>
          </>
        ) : (
          buttonText
        )}
      </button>
    );
  };

  const handleCheckOut = async () => {
    if (!user || !firebaseDb || isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);
      const now = new Date();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const attendanceRef = collection(firebaseDb, 'attendance');
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

      await updateDoc(doc(firebaseDb, 'attendance', todayRecord.id), {
        outTime: Timestamp.fromDate(now),
        overtime: overtimeHours
      });

      await checkTodayAttendance(); // Refresh attendance status
      await fetchAttendanceRecords(); // Refresh records
      setError('Successfully checked out!');
      
    } catch (error: unknown) {
      console.error('Error checking out:', error);
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('requires an index')) {
        setError('System is updating. Please try again in a few minutes.');
      } else {
        setError('Unable to check out. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify the button render to be more informative
  const renderCheckOutButton = () => {
    const buttonText = isProcessing ? 'Processing...' : 'Check Out';
    const isDisabled = !hasCheckedInToday || isProcessing;
    const buttonClass = `flex-1 px-4 py-2.5 rounded-lg text-sm md:text-base font-medium ${
      isDisabled
        ? 'bg-gray-300 cursor-not-allowed'
        : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
    } text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 min-w-[120px] justify-center items-center inline-flex`;

    return (
      <button
        onClick={handleCheckOut}
        disabled={isDisabled}
        className={buttonClass}
        title={
          !hasCheckedInToday ? 'Check in first' :
          isProcessing ? 'Processing...' :
          'Click to check out'
        }
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            <span>Processing...</span>
          </>
        ) : (
          buttonText
        )}
      </button>
    );
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <p className="text-gray-600 text-center px-4">Please log in to access the attendance system.</p>
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
                {renderCheckInButton()}
                {renderCheckOutButton()}
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