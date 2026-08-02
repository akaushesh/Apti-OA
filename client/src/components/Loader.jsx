import React from 'react';

function Loader({ text = "Loading..." }) {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col justify-center items-center p-6 text-slate-700">
      <div className="relative flex items-center justify-center">
        {/* Animated outer ring */}
        <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
        {/* Inner brand icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500 tracking-wide animate-pulse">
        {text}
      </p>
    </div>
  );
}

export default Loader;