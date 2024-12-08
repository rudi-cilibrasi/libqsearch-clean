import React from 'react';

const AutoLabelingToggle = ({ enabled, onToggle }) => {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Auto-labeling</span>
            <button
                onClick={onToggle}
                className={`
          relative inline-flex h-5 w-10
          items-center rounded-full 
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${enabled ? 'bg-blue-600' : 'bg-gray-300'}
          hover:${enabled ? 'bg-blue-700' : 'bg-gray-400'}
          active:scale-95
          px-0.5
        `}
            >
        <span
            className={`
            inline-block h-4 w-4
            transform rounded-full 
            transition-all duration-200 ease-in-out
            bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
            </button>
        </div>
    );
};

export default AutoLabelingToggle;