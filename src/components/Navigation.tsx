import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Navigation() {
  const { user, isManager, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : '';
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/dashboard" className="text-xl font-bold">
                Brand Care Attendance System
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard')}`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/my-attendance"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard/my-attendance')}`}
                >
                  My Attendance
                </Link>
                {isManager && (
                  <Link
                    href="/dashboard/reports"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard/reports')}`}
                  >
                    Reports
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <span className="text-sm mr-4">{user?.email}</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  isLoggingOut 
                    ? 'bg-blue-500 cursor-not-allowed'
                    : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                <div className="flex items-center">
                  {isLoggingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span>Logging out...</span>
                    </>
                  ) : (
                    'Logout'
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 