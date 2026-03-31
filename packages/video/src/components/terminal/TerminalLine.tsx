import { interpolate, useCurrentFrame } from "remotion";

type TerminalLineProps = {
	children: React.ReactNode;
	startFrame?: number;
	fadeFrames?: number;
};

/** Single terminal line that fades in — replaces AnimatedSpan */
export const TerminalLine: React.FC<TerminalLineProps> = ({
	children,
	startFrame = 0,
	fadeFrames = 8,
}) => {
	const frame = useCurrentFrame();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const opacity = interpolate(relFrame, [0, fadeFrames], [0, 1], {
		extrapolateRight: "clamp",
	});
	const y = interpolate(relFrame, [0, fadeFrames], [-4, 0], {
		extrapolateRight: "clamp",
	});

	return (
		<div
			style={{
				opacity,
				transform: `translateY(${y}px)`,
				whiteSpace: "pre",
			}}
		>
			{children}
		</div>
	);
};
