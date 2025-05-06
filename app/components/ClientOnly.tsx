'use client';

import { useState, useEffect, ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  // Use immediate mounting for development and effect-based for production
  useEffect(() => {
    console.log('ClientOnly component mounting attempt');
    
    // Ensure we're in a browser environment
    if (typeof window !== 'undefined') {
      console.log('Browser environment detected, setting mount state');
      setHasMounted(true);
    }
  }, []);

  // For debugging
  useEffect(() => {
    if (hasMounted) {
      console.log('ClientOnly component has mounted, children now rendering');
    }
  }, [hasMounted]);

  if (!hasMounted) {
    console.log('Component not yet mounted, showing fallback');
    return <>{fallback}</>;
  }

  return <>{children}</>;
} 