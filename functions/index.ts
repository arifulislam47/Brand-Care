import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

admin.initializeApp();

exports.markAbsentEmployees = onSchedule({
  schedule: '0 11 * * *',
  timeZone: 'Asia/Dhaka', // Set your timezone
}, async (event: ScheduledEvent): Promise<void> => {
  try {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all users except those who already have an attendance record for today
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Check if user already has an attendance record for today
      const attendanceQuery = await db.collection('attendance')
        .where('userId', '==', userId)
        .where('date', '>=', admin.firestore.Timestamp.fromDate(today))
        .get();

      const hasAttendanceRecord = attendanceQuery.docs.some(doc => {
        const recordDate = doc.data().date.toDate();
        return recordDate.getDate() === today.getDate() &&
               recordDate.getMonth() === today.getMonth() &&
               recordDate.getFullYear() === today.getFullYear();
      });

      // If no attendance record exists, mark as absent
      if (!hasAttendanceRecord) {
        await db.collection('attendance').add({
          userId: userId,
          date: admin.firestore.Timestamp.fromDate(today),
          inTime: null,
          outTime: null,
          status: 'ABSENT',
          overtime: 0,
        });
        console.log(`Marked user ${userId} as absent for ${today.toDateString()}`);
      }
    }
  } catch (error) {
    console.error('Error in markAbsentEmployees function:', error);
    throw error;
  }
}); 