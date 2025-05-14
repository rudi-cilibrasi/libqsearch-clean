import React from "react";
import { Search } from 'lucide-react';

const SearchBar = ({ value, onChange, placeholder = "Search..." }) => (
	<div className="relative">
		<input
			type="text"
			className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2 px-4 pl-8 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			placeholder={placeholder}
			value={value}
			onChange={onChange}
		/>
		<div className="absolute left-3 top-2.5 text-gray-400">
			<Search className="h-4 w-4" />
		</div>
	</div>
);

export default SearchBar;
