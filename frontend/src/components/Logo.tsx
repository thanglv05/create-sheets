'use client';
import React from 'react';

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15))' }}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#12b886" /> {/* Teal/Green for Sheets */}
          <stop offset="100%" stopColor="#228be6" /> {/* Blue for automation */}
        </linearGradient>
        <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffec99" />
          <stop offset="100%" stopColor="#fab005" />
        </linearGradient>
      </defs>
      {/* Background Rounded Card */}
      <rect x="5" y="5" width="90" height="90" rx="24" fill="url(#logo-grad)" />
      
      {/* Grid Pattern (Spreadsheet Cells) */}
      <rect x="25" y="25" width="50" height="50" rx="8" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="4" strokeLinejoin="round" />
      {/* Grid lines */}
      <line x1="25" y1="42" x2="75" y2="42" stroke="white" strokeWidth="3" strokeOpacity="0.4" />
      <line x1="25" y1="58" x2="75" y2="58" stroke="white" strokeWidth="3" strokeOpacity="0.4" />
      <line x1="45" y1="25" x2="45" y2="75" stroke="white" strokeWidth="3" strokeOpacity="0.4" />

      {/* Auto Bolt Overlay */}
      <path
        d="M58 15 L32 55 H52 L42 85 L72 45 H50 L58 15 Z"
        fill="url(#bolt-grad)"
        stroke="#0d2b45"
        strokeWidth="3"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.35))' }}
      />
    </svg>
  );
}
