import React from 'react';
import { APP_ICON_DATA_URI } from '../utils/appIconData';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#090D16] text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
          <img
            src={APP_ICON_DATA_URI}
            alt="আমার হিসাব"
            className="w-16 h-16 rounded-2xl mb-4 shadow-md"
          />
          <h1 className="text-lg font-bold">সাময়িক সমস্যা হয়েছে</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1.5 leading-relaxed">
            আপনার সংরক্ষিত হিসাব সম্পূর্ণ নিরাপদ আছে। অনুগ্রহ করে অ্যাপটি পুনরায় লোড করুন।
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-[44px] px-5 rounded-2xl bg-[#0B2620] text-white text-xs font-semibold"
          >
            পুনরায় লোড করুন
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
