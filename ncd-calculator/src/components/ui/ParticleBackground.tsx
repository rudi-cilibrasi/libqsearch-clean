import React from "react";

const ParticleBackground = () => (
	<div className="absolute inset-0 overflow-hidden pointer-events-none">
		<div className="particles-container h-full w-full opacity-30">
			{Array(25).fill().map((_, i) => (
				<div
					key={i}
					className="particle absolute rounded-full bg-gradient-to-br from-blue-400 to-purple-500"
					style={{
						width: `${Math.random() * 6 + 2}px`,
						height: `${Math.random() * 6 + 2}px`,
						top: `${Math.random() * 100}%`,
						left: `${Math.random() * 100}%`,
						opacity: Math.random() * 0.5 + 0.3,
						animation: `float ${Math.random() * 20 + 15}s linear infinite`,
						animationDelay: `${Math.random() * 5}s`,
					}}
				/>
			))}
		</div>
	</div>
);

export default ParticleBackground;
