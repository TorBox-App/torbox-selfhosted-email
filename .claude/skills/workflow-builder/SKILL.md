---
name: workflow-builder
description: Build and modify the workflow automation system with React Flow. Use when working on workflow canvas, nodes, or automation logic.
---

# Workflow Builder Skill

You are an expert at building and modifying the workflow automation system.

## Architecture Overview

- **UI**: React Flow canvas with custom nodes
- **State**: Zustand store (`use-workflow-store.ts`)
- **Validation**: `workflow-validation.ts`
- **Persistence**: Server actions → Drizzle → PostgreSQL JSONB

## Step Types

| Type | Config Required | Outputs |
|------|-----------------|---------|
| `trigger` | Depends on triggerType | single |
| `send_email` | `templateId` | single |
| `send_sms` | `body` | single |
| `delay` | `amount`, `unit` | single |
| `condition` | `field`, `operator`, `value` | yes/no branches |
| `webhook` | `url`, `method` | single |
| `update_contact` | `updates[]` | single |
| `wait_for_event` | `eventName` | yes/timeout branches |
| `wait_for_email_engagement` | timeout | opened/clicked/bounced/none |
| `subscribe_topic` | `topicId`, `channel` | single |
| `unsubscribe_topic` | `topicId`, `channel` | single |
| `exit` | none | none |

## Trigger Types

| Type | Required Config |
|------|-----------------|
| `event` | `eventName` |
| `contact_created` | none |
| `contact_updated` | none |
| `segment_entry` | `segmentId` |
| `segment_exit` | `segmentId` |
| `schedule` | `schedule` (cron), `timezone` |
| `api` | none |
| `topic_subscribed` | `topicId` |
| `topic_unsubscribed` | `topicId` |

## Data Structures

### WorkflowStep
```typescript
type WorkflowStep = {
  id: string;
  type: WorkflowStepType;
  name: string;
  position: { x: number; y: number };
  config: WorkflowStepConfig;
};
```

### WorkflowTransition
```typescript
type WorkflowTransition = {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition?: {
    branch: "yes" | "no" | "timeout" | "default" | "opened" | "clicked" | "bounced";
  };
};
```

## Adding a New Node Type

### 1. Update Schema Types
```typescript
// packages/db/src/schema/workflows.ts
export type WorkflowStepType = "my_new_step" | /* existing */;

export type WorkflowStepConfig =
  | { type: "my_new_step"; myField: string; optionalField?: number }
  | /* existing */;
```

### 2. Create Node Component
```typescript
// apps/web/src/components/workflow-builder/nodes/my-new-step-node.tsx
export function MyNewStepNode({ id, data, selected }: NodeProps) {
  const { isValid, errorMessage } = useNodeValidation(id);

  return (
    <BaseNode
      icon={<MyIcon className="h-4 w-4" />}
      label={data.name}
      description={data.config.myField || "Not configured"}
      accentColor="bg-cyan-500"
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
```

### 3. Register Node Type
```typescript
// workflow-canvas.tsx
const nodeTypes: NodeTypes = {
  my_new_step: MyNewStepNode,
  // ...existing
};
```

### 4. Add to Palette
```typescript
// node-palette.tsx
const paletteItems: NodePaletteItem[] = [
  {
    type: "my_new_step",
    label: "My New Step",
    description: "Does something useful",
    icon: <MyIcon className="h-4 w-4" />,
    accentColor: "bg-cyan-500",
  },
  // ...existing
];
```

### 5. Add Config Component
```typescript
// workflow-properties-panel.tsx
function MyNewStepConfig({ config, onChange }) {
  return (
    <div className="space-y-2">
      <Label>My Field</Label>
      <Input
        value={config.myField || ""}
        onChange={(e) => onChange({ ...config, myField: e.target.value })}
      />
    </div>
  );
}

// Add to switch statement in PropertiesPanel
case "my_new_step":
  return <MyNewStepConfig config={config} onChange={handleConfigChange} />;
```

### 6. Add Validation
```typescript
// workflow-validation.ts
function validateMyNewStep(nodeId: string, config: WorkflowStepConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.type !== "my_new_step") return errors;

  if (!config.myField?.trim()) {
    errors.push({
      nodeId,
      field: "myField",
      message: "My field is required",
      severity: "error",
    });
  }

  return errors;
}
```

## Validation Rules

1. Exactly 1 trigger node
2. At least 1 action step (not trigger/exit)
3. All transitions reference valid step IDs
4. No orphan nodes (must be reachable from trigger)
5. Step-specific validation (templateId required for send_email, etc.)

## Key Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/workflows.ts` | Types & schema |
| `apps/web/src/components/workflow-builder/` | All UI |
| `use-workflow-store.ts` | Zustand state |
| `apps/web/src/lib/workflow-validation.ts` | Validation |
| `apps/web/src/actions/workflows.ts` | Server actions |

## Common Mistakes

1. **Forgetting to register node type** in `nodeTypes` object
2. **Missing validation** for required config fields
3. **Not handling multi-output nodes** (condition has yes/no branches)
4. **Mutating store state directly** instead of using store actions
