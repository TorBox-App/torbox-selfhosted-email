import { create } from "zustand";

type LocalState = {
  selectedBrandKitId: string | null;
};

type TemplateStoreActions = {
  setSelectedBrandKitId: (id: string | null) => void;
};

type TemplateStore = {
  localState: LocalState;
  actions: TemplateStoreActions;
};

const initialLocalState: LocalState = {
  selectedBrandKitId: null,
};

export const useTemplateStore = create<TemplateStore>((set) => ({
  localState: initialLocalState,

  actions: {
    setSelectedBrandKitId: (id) =>
      set((state) => ({
        localState: {
          ...state.localState,
          selectedBrandKitId: id,
        },
      })),
  },
}));

export const useSelectedBrandKitId = () =>
  useTemplateStore((state) => state.localState.selectedBrandKitId);
export const useTemplateActions = () =>
  useTemplateStore((state) => state.actions);
