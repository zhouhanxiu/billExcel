'use client';

import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  showCount?: boolean;
}

export function ProgressBar({ 
  current, 
  total, 
  label,
  showPercentage = true,
  showCount = true,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1 text-sm text-gray-600">
          <span>{label}</span>
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showCount && (
        <div className="text-xs text-gray-500 mt-1 text-center">
          {current} / {total}
        </div>
      )}
    </div>
  );
}

interface ModalProgressProps {
  open: boolean;
  current: number;
  total: number;
  title: string;
  message?: string;
}

export function ModalProgress({ open, current, total, title, message }: ModalProgressProps) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <ProgressBar current={current} total={total} label="处理进度" />
        {message && (
          <p className="text-sm text-gray-600 mt-3">{message}</p>
        )}
      </div>
    </div>
  );
}
