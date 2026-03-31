import { TerminalTyping } from "@/components/terminal";

/** Scene 1: User types `npx wraps email init` */
export const TypingCommand: React.FC = () => (
	<TerminalTyping
		text="npx wraps email init"
		prefix="$ "
		prefixColor="var(--muted-foreground)"
		charFrames={3}
		cursor
	/>
);
