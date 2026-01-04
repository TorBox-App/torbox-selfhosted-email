"use client";

import { AlertCircle, Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { extractTemplateVariables } from "@/actions/batch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExtractedVariable, VariableMapping } from "@/lib/batch";
import { cn } from "@/lib/utils";

type VariableMapperProps = {
  organizationId: string;
  templateId: string;
  mappings: VariableMapping[];
  onChange: (mappings: VariableMapping[]) => void;
};

// Contact fields available for mapping
const CONTACT_FIELDS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job Title" },
];

export function VariableMapper({
  organizationId,
  templateId,
  mappings,
  onChange,
}: VariableMapperProps) {
  const [variables, setVariables] = useState<ExtractedVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch variables when templateId changes
  useEffect(() => {
    async function fetchVariables() {
      if (!templateId) {
        setVariables([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const result = await extractTemplateVariables(organizationId, templateId);
      if (result.success) {
        setVariables(result.variables);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchVariables();
  }, [organizationId, templateId]);

  // Get custom variables that need mapping
  const customVariables = variables.filter((v) => !v.isKnown);
  const knownVariables = variables.filter((v) => v.isKnown);

  // Check if all custom variables are mapped
  const unmappedCount = customVariables.filter((v) => {
    const mapping = mappings.find((m) => m.variableName === v.name);
    if (!mapping) return true;
    if (mapping.source.type === "static" && !mapping.source.value.trim())
      return true;
    if (mapping.source.type === "contact" && !mapping.source.field) return true;
    return false;
  }).length;

  // Update a single mapping
  const updateMapping = (
    variableName: string,
    source: VariableMapping["source"]
  ) => {
    const newMappings = mappings.filter((m) => m.variableName !== variableName);
    newMappings.push({ variableName, source });
    onChange(newMappings);
  };

  // Get current mapping for a variable
  const getMapping = (variableName: string): VariableMapping | undefined =>
    mappings.find((m) => m.variableName === variableName);

  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader className="py-3">
          <CardTitle className="text-base">Template Variables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className="mt-4" variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // No variables in template
  if (variables.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
        <CardHeader className="py-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Template Variables</CardTitle>
              {unmappedCount > 0 && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-700">
                  {unmappedCount} needs mapping
                </span>
              )}
              {unmappedCount === 0 && customVariables.length > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 text-xs">
                  All mapped
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Known variables (auto-mapped) */}
            {knownVariables.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-muted-foreground text-sm">
                  Auto-mapped ({knownVariables.length})
                </p>
                <div className="space-y-1">
                  {knownVariables.map((v) => (
                    <div
                      className="flex items-center gap-2 text-sm"
                      key={v.name}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-xs">{v.name}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{v.label || getCategoryLabel(v.category)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom variables (need mapping) */}
            {customVariables.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-muted-foreground text-sm">
                  Needs mapping ({customVariables.length})
                </p>
                <div className="space-y-4">
                  {customVariables.map((v) => (
                    <VariableMapperRow
                      key={v.name}
                      mapping={getMapping(v.name)}
                      onUpdate={(source) => updateMapping(v.name, source)}
                      variable={v}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function VariableMapperRow({
  variable,
  mapping,
  onUpdate,
}: {
  variable: ExtractedVariable;
  mapping?: VariableMapping;
  onUpdate: (source: VariableMapping["source"]) => void;
}) {
  const sourceType = mapping?.source.type || "static";
  const staticValue =
    mapping?.source.type === "static" ? mapping.source.value : "";
  const contactField =
    mapping?.source.type === "contact" ? mapping.source.field : "";

  const hasError =
    !mapping ||
    (sourceType === "static" && !staticValue.trim()) ||
    (sourceType === "contact" && !contactField);

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        hasError ? "border-yellow-200 bg-yellow-50" : "border-border"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium font-mono text-sm">{variable.name}</span>
        {variable.fallback && (
          <span className="text-muted-foreground text-xs">
            (fallback: "{variable.fallback}")
          </span>
        )}
      </div>

      <RadioGroup
        className="space-y-2"
        onValueChange={(value: "static" | "contact") => {
          if (value === "static") {
            onUpdate({ type: "static", value: staticValue });
          } else {
            onUpdate({ type: "contact", field: contactField });
          }
        }}
        value={sourceType}
      >
        {/* Static value option */}
        <div className="flex items-start space-x-2">
          <RadioGroupItem id={`${variable.name}-static`} value="static" />
          <div className="flex-1 space-y-1">
            <Label
              className="cursor-pointer text-sm"
              htmlFor={`${variable.name}-static`}
            >
              Static value
            </Label>
            {sourceType === "static" && (
              <Input
                className="h-8"
                onChange={(e) =>
                  onUpdate({ type: "static", value: e.target.value })
                }
                placeholder="Enter value..."
                value={staticValue}
              />
            )}
          </div>
        </div>

        {/* Contact field option */}
        <div className="flex items-start space-x-2">
          <RadioGroupItem id={`${variable.name}-contact`} value="contact" />
          <div className="flex-1 space-y-1">
            <Label
              className="cursor-pointer text-sm"
              htmlFor={`${variable.name}-contact`}
            >
              Contact field
            </Label>
            {sourceType === "contact" && (
              <Select
                onValueChange={(value) =>
                  onUpdate({ type: "contact", field: value })
                }
                value={contactField}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}

function getCategoryLabel(category: ExtractedVariable["category"]): string {
  switch (category) {
    case "contact":
      return "Contact Field";
    case "organization":
      return "Organization";
    case "system":
      return "System";
    case "custom":
      return "Custom";
    default:
      return category;
  }
}
