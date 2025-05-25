import { exportedDb as firebaseDb } from './firebase';
import { collection, query, getDocs, where, addDoc, Timestamp } from 'firebase/firestore';
import { startOfDay } from 'date-fns';

export const markAbsentEmployees = async () => {
  try {
    // Get today's date at 00:00:00
    const today = startOfDay(new Date());
    const todayTimestamp = Timestamp.fromDate(today);

    // Get all users
    const usersSnapshot = await getDocs(collection(firebaseDb, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // For each user, check if they have an attendance record for today
    for (const user of users) {
      const attendanceRef = collection(firebaseDb, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', user.id),
        where('date', '>=', todayTimestamp)
      );

      const querySnapshot = await getDocs(q);
      const todayRecord = querySnapshot.docs.find(doc => 
        doc.data().date.toDate().getDate() === today.getDate()
      );

      // If no record exists for today, create an absent record
      if (!todayRecord) {
        const absentRecord = {
          userId: user.id,
          date: todayTimestamp,
          inTime: null,
          outTime: null,
          status: 'ABSENT',
          overtime: 0,
        };
        await addDoc(collection(firebaseDb, 'attendance'), absentRecord);
        console.log(`Marked user ${user.id} as absent for ${today.toDateString()}`);
      }
    }
  } catch (error) {
    console.error('Error marking absent employees:', error);
    throw error;
  }
}; 