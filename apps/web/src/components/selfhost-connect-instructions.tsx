import { CliCommand } from "@/components/cli-command";
import { cn } from "@/lib/utils";

type SelfhostConnectInstructionsProps = {
  className?: string;
};

/**
 * Shown instead of the CloudFormation quick-create link on self-hosted
 * deployments. The hosted template creates a role that trusts the Wraps
 * platform account, which a self-hosted control plane cannot assume.
 */
export function SelfhostConnectInstructions({
  className,
}: SelfhostConnectInstructionsProps) {
  return (
    <div className={cn("space-y-3 rounded-lg bg-muted/50 p-4", className)}>
      <h3 className="font-semibold text-sm">Connect with the CLI</h3>
      <CliCommand command="wraps selfhost connect" />
      <p className="text-muted-foreground text-sm">
        Self-hosted deployments create{" "}
        <code className="font-mono">wraps-selfhost-console-access-role</code>,
        which trusts your own AWS account. The hosted CloudFormation template
        creates a role that trusts the Wraps platform account, which your
        deployment cannot use.
      </p>
    </div>
  );
}
