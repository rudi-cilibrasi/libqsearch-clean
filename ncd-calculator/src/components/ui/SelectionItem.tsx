import React from "react";
import { X } from 'lucide-react';

const SelectionItem = ({ item, onRemove }) => (
	<div className="bg-gray-900 rounded-lg p-3 flex justify-between items-center">
		<div className="flex items-center gap-2">
			<span className="text-blue-400 text-sm">•</span>
			<span>{item.name}</span>
		</div>
		<button className="text-gray-400 hover:text-gray-200" onClick={() => onRemove(item.id)}>
			<X className="h-4 w-4" />
		</button>
	</div>
);

export default SelectionItem;
