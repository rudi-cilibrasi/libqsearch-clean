import React from "react";

const TabButton = ({ active, onClick, icon: Icon, children }) => (
	<button
		className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2
      ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
		onClick={onClick}
	>
		{Icon && <Icon className="h-4 w-4" />}
		{children}
	</button>
);

export default TabButton;
