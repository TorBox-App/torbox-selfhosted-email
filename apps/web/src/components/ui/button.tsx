import { Button as BaseButton } from "@wraps/ui/components/ui/button";
import type * as React from "react";

export { buttonVariants } from "@wraps/ui/components/ui/button";

function Button({
  size = "touch",
  ...props
}: React.ComponentProps<typeof BaseButton>) {
  return <BaseButton size={size} {...props} />;
}

export { Button };
