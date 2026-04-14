import {
  Button as BaseButton,
  buttonVariants,
} from "@wraps/ui/components/ui/button";
import type * as React from "react";

function Button({
  size = "touch",
  ...props
}: React.ComponentProps<typeof BaseButton>) {
  return <BaseButton size={size} {...props} />;
}

export { Button, buttonVariants };
