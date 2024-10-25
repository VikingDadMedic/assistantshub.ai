'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

export const SignInMenu = function () {
  const router = useRouter();

  return (
    <button
      className="p-[3px] relative"
      onClick={() => {
        router.push('/api/auth/login');
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg" />
      <div className="px-8 py-2 bg-black rounded-[6px] relative group transition duration-200 text-white hover:bg-transparent">
        Sign In
      </div>
    </button>
  );
};
