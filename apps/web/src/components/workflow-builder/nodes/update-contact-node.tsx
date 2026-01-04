"use client";

import { UserCog } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type UpdateContactNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function UpdateContactNode({ data, selected }: UpdateContactNodeProps) {
  const config = data.config;
  let description = "No updates configured";

  if (config.type === "update_contact" && config.updates?.length > 0) {
    const count = config.updates.length;
    description = `${count} field${count !== 1 ? "s" : ""} to update`;
  }

  return (
    <BaseNode
      icon={<UserCog className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-indigo-500"
      hasInput={true}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
