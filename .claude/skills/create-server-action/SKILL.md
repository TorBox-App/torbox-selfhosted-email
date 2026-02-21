---
name: create-server-action
description: Create Next.js server actions with TanStack Form validation. Use when building form submission handlers or API mutations.
---

# Create Server Action Skill

You are an expert at building Next.js server actions with TanStack Form validation for the Wraps monorepo.

## Core Principles

1. **Use `@tanstack/react-form-nextjs`** — NOT `@tanstack/react-form/nextjs` (separate package)
2. **Share form options** between client and server via `formOptions()` + shared Zod schema
3. **Server-side validation is the security boundary** — never trust client input alone
4. **Always call `verifyOrgAccess`** before any database operation
5. **Return structured responses** with `success` flag

## The Three-File Pattern

Every form submission follows this pattern:

```
lib/forms/my-feature.ts          # Zod schema + formOptions()
actions/my-feature.ts             # Server action with createServerValidate
components/forms/my-feature.tsx   # Client form with useForm + mergeForm
```

### 1. Define Form Schema (`lib/forms/my-feature.ts`)

```typescript
import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const myFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address"),
});

export type MyFormInput = z.infer<typeof myFormSchema>;

export const myFormOpts = formOptions({
  defaultValues: {
    name: "",
    email: "",
  } satisfies MyFormInput,
});
```

### 2. Create Server Action (`actions/my-feature.ts`)

```typescript
"use server";

import { createServerValidate } from "@tanstack/react-form-nextjs";
import { db, myTable } from "@wraps/db";
import { revalidatePath } from "next/cache";
import { myFormOpts, myFormSchema } from "@/lib/forms/my-feature";
import { createActionLogger, serializeError } from "@/lib/logger";
import { verifyOrgAccess } from "@/lib/auth";

const serverValidate = createServerValidate({
  ...myFormOpts,
  onServerValidate: ({ value }) => {
    const result = myFormSchema.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message || "Validation failed";
    }
  },
});

export async function createItemAction(
  organizationId: string,
  prev: unknown,
  formData: FormData
) {
  const log = createActionLogger("createItemAction", { organizationId });

  try {
    // 1. Auth check
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "No access" };
    }

    // 2. Validate form data
    const validatedData = await serverValidate(formData);

    // 3. Business logic
    const [result] = await db
      .insert(myTable)
      .values({
        organizationId,
        name: validatedData.name,
        email: validatedData.email,
      })
      .returning();

    // 4. Revalidate cache (use orgSlug, not organizationId)
    revalidatePath(`/${access.orgSlug}/my-page`, "page");

    log.info({ itemId: result.id }, "Item created");
    return { success: true, data: result };
  } catch (e) {
    // Handle TanStack Form validation errors
    if (e && typeof e === "object" && "formState" in e) {
      return (e as { formState: unknown }).formState;
    }

    log.error({ err: serializeError(e) }, "Failed to create item");
    return { success: false, error: "Internal error" };
  }
}
```

### 3. Create Client Form (`components/forms/my-feature-form.tsx`)

```typescript
"use client";

import { mergeForm, useForm } from "@tanstack/react-form";
import { initialFormState, useTransform } from "@tanstack/react-form-nextjs";
import { useStore } from "@tanstack/react-store";
import { useActionState } from "react";
import { createItemAction } from "@/actions/my-feature";
import { myFormOpts } from "@/lib/forms/my-feature";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  organizationId: string;
};

export function MyFeatureForm({ organizationId }: Props) {
  const [state, action] = useActionState(
    createItemAction.bind(null, organizationId),
    initialFormState
  );

  const form = useForm({
    ...myFormOpts,
    transform: useTransform(
      (baseForm) => mergeForm(baseForm, state ?? {}),
      [state]
    ),
  });

  const formErrors = useStore(form.store, (formState) => formState.errors);

  return (
    <form action={action as never} onSubmit={() => form.handleSubmit()}>
      {/* Form-level errors */}
      {formErrors.map((error) => (
        <p key={error as string} className="text-destructive text-sm">
          {error}
        </p>
      ))}

      {/* Name Field */}
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            !value ? "Name is required" : undefined,
        }}
      >
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldContent>
            </Field>
          );
        }}
      </form.Field>

      {/* Submit */}
      <form.Subscribe
        selector={(formState) => [formState.canSubmit, formState.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
            Create
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

## Key Imports

```typescript
// Schema file (lib/forms/*.ts)
import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

// Server action (actions/*.ts)
import { createServerValidate } from "@tanstack/react-form-nextjs";

// Client form (components/forms/*.tsx)
import { mergeForm, useForm } from "@tanstack/react-form";
import { initialFormState, useTransform } from "@tanstack/react-form-nextjs";
import { useStore } from "@tanstack/react-store";
import { useActionState } from "react";
```

**NEVER use**:
- `@tanstack/react-form/nextjs` (subpath) — the package is `@tanstack/react-form-nextjs`
- `ServerValidateError` class — use duck-typing: `"formState" in e`

## Server Action Without Form (Direct Mutations)

For actions called programmatically (not from a TanStack Form), use this simpler pattern:

```typescript
"use server";

export async function deleteItem(
  organizationId: string,
  itemId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await verifyOrgAccess(organizationId);
  if (!access) return { success: false, error: "No access" };

  await db
    .delete(myTable)
    .where(
      and(eq(myTable.id, itemId), eq(myTable.organizationId, organizationId))
    );

  revalidatePath(`/${access.orgSlug}/my-page`, "page");
  return { success: true };
}
```

## Common Mistakes

### 1. Wrong Package Import
```typescript
// BAD — subpath import doesn't exist
import { formOptions } from "@tanstack/react-form/nextjs";

// GOOD — separate package
import { formOptions } from "@tanstack/react-form-nextjs";
```

### 2. Missing Auth Check
```typescript
// BAD — no access verification
export async function myAction(orgId: string, prev: unknown, formData: FormData) {
  const data = await serverValidate(formData);
  await db.insert(myTable).values({ organizationId: orgId, ...data });
}

// GOOD — always verify access first
export async function myAction(orgId: string, prev: unknown, formData: FormData) {
  const access = await verifyOrgAccess(orgId);
  if (!access) return { success: false, error: "No access" };
  const data = await serverValidate(formData);
  await db.insert(myTable).values({ organizationId: orgId, ...data });
}
```

### 3. Wrong Revalidation Path
```typescript
// BAD — using UUID instead of slug
revalidatePath(`/${organizationId}/contacts`, "page");

// GOOD — use orgSlug from verifyOrgAccess
revalidatePath(`/${access.orgSlug}/contacts`, "page");
```

### 4. Catching ServerValidateError Wrong
```typescript
// BAD — ServerValidateError may not be exported
if (e instanceof ServerValidateError) { ... }

// GOOD — duck-type check
if (e && typeof e === "object" && "formState" in e) {
  return (e as { formState: unknown }).formState;
}
```

## Reference Files

| Pattern | Example |
|---------|---------|
| Form schema | `apps/web/src/lib/forms/connect-aws-account.ts` |
| Server action | `apps/web/src/actions/aws-accounts.ts` |
| Client form | `apps/web/src/components/forms/connect-aws-account-form.tsx` |
| Direct mutation | `apps/web/src/actions/contacts.ts` |
