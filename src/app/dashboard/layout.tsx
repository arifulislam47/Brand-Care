'use client';

import { useAuth } from '@/contexts/AuthContext';
import Navigation from '@/components/Navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Memoize the authentication state
  const isAuthenticated = useMemo(() => !!user, [user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle authentication check
  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, loading, isAuthenticated, router]);

  // Don't render anything until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  // Show loading state only during initial authentication check
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not loading, don't render anything
  if (!isAuthenticated) {
    return null;
  }

  // Show dashboard when authenticated
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
} 