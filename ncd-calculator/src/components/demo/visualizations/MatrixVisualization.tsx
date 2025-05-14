import React from "react";

const MatrixVisualization = () => (
	<div className="flex items-center justify-center h-full">
		<div className="w-4/5 max-w-lg">
			<table className="w-full border-collapse">
				<thead>
				<tr>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">ID</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">Sheepdog</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">Elkhound</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">Jamthund</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">Basenji</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">English</th>
					<th className="border border-gray-700 bg-gray-800 p-2 text-xs">French</th>
				</tr>
				</thead>
				<tbody>
				<tr>
					<td className="border border-gray-700 bg-gray-800 p-2 text-xs">Sheepdog</td>
					<td className="border border-gray-700 bg-blue-900 p-2 text-xs text-center">0.0000</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0448</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0491</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0500</td>
					<td className="border border-gray-700 bg-blue-500/20 p-2 text-xs text-center">0.9931</td>
					<td className="border border-gray-700 bg-blue-500/20 p-2 text-xs text-center">0.9952</td>
				</tr>
				<tr>
					<td className="border border-gray-700 bg-gray-800 p-2 text-xs">Elkhound</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0448</td>
					<td className="border border-gray-700 bg-blue-900 p-2 text-xs text-center">0.0000</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0510</td>
					<td className="border border-gray-700 bg-blue-800/30 p-2 text-xs text-center">0.0531</td>
					<td className="border border-gray-700 bg-blue-500/20 p-2 text-xs text-center">0.9913</td>
					<td className="border border-gray-700 bg-blue-500/20 p-2 text-xs text-center">0.9940</td>
				</tr>
				</tbody>
			</table>
			<div className="flex justify-center gap-8 mt-6">
				<div className="flex items-center gap-2">
					<div className="w-4 h-4 bg-blue-900"></div>
					<span className="text-xs">0.0000 (Identical)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-4 bg-blue-500/20"></div>
					<span className="text-xs">1.0000 (Different)</span>
				</div>
			</div>
		</div>
	</div>
);

export default MatrixVisualization;
