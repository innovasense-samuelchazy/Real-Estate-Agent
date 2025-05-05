'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-violet-950 to-violet-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
      <button
        onClick={reset}
        className="px-4 py-2 bg-violet-600 rounded-md hover:bg-violet-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
} 