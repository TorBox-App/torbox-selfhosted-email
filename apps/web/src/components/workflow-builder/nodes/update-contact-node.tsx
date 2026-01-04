"use client";

import { UserCog } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type UpdateContactNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function UpdateContactNode({ id, data, selected }: UpdateContactNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
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
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
