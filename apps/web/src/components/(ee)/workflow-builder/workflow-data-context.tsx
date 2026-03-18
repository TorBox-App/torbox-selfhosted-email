"use client";

import { createContext, useContext, useState } from "react";

type Topic = {
  id: string;
  name: string;
};

type Segment = {
  id: string;
  name: string;
};

type WorkflowDataContextValue = {
  topics: Topic[];
  segments: Segment[];
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  workflowId: string;
};

const WorkflowDataContext = createContext<WorkflowDataContextValue>({
  topics: [],
  segments: [],
  showStats: false,
  setShowStats: () => {},
  workflowId: "",
});

export function WorkflowDataProvider({
  topics,
  segments,
  workflowId,
  children,
}: {
  topics: Topic[];
  segments: Segment[];
  workflowId: string;
  children: React.ReactNode;
}) {
  const [showStats, setShowStats] = useState(false);

  return (
    <WorkflowDataContext.Provider
      value={{ topics, segments, showStats, setShowStats, workflowId }}
    >
      {children}
    </WorkflowDataContext.Provider>
  );
}

export function useWorkflowData() {
  return useContext(WorkflowDataContext);
}
