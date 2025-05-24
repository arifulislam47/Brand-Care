# Employee Attendance Management System

A web-based attendance management system built with Next.js and Firebase, allowing employees to mark their attendance and managers to generate reports.

## Features

- User Authentication (Employee and Manager roles)
- Daily attendance tracking (Check-in and Check-out)
- Manager dashboard with attendance reports
- PDF report generation
- Mobile-responsive design
- Secure role-based access control

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd attendance-system
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Get your Firebase configuration

4. Create a `.env.local` file in the root directory and add your Firebase configuration:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Employee
1. Register a new account
2. Log in with your credentials
3. Mark your daily attendance (Check-in/Check-out)

### Manager
1. Register a new account with the "Register as Manager" option
2. Access the reports page from the dashboard
3. View attendance records and generate PDF reports
4. Filter records by date range

## Firebase Security Rules

Add these security rules to your Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /attendance/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isManager ||
        request.resource.data.userId == request.auth.uid
      );
    }
  }
}
```

## Deployment

The application can be deployed to Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel
4. Deploy

## License

MIT
