import React from "react";
import { Activity } from 'lucide-react';

const Footer = () => {
	return (
		<footer className="bg-gradient-to-t from-gray-950 to-gray-900 py-8 border-t border-gray-800">
			<div className="container mx-auto px-4 md:px-6">
				<div className="flex flex-col md:flex-row justify-between items-center">
					<div className="flex items-center mb-4 md:mb-0">
						<Activity className="h-5 w-5 text-blue-400 mr-2" />
						<span className="text-white font-bold">NCD Calculator</span>
					</div>
					<div className="flex gap-6">
						<a href="#" className="text-gray-400 hover:text-white transition-colors">About</a>
						<a href="#" className="text-gray-400 hover:text-white transition-colors">Documentation</a>
						<a href="#" className="text-gray-400 hover:text-white transition-colors">GitHub</a>
						<a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a>
					</div>
				</div>
				<div className="mt-6 text-center text-gray-500 text-sm">
					&copy; {new Date().getFullYear()} NCD Calculator. All rights reserved.
				</div>
			</div>
		</footer>
	);
};

export default Footer;
