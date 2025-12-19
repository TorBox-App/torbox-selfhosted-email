import { create } from "zustand";

export type ProductsStatus = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  hasAwsAccounts: boolean;
};

type ProductsStore = {
  status: ProductsStatus | null;
  orgId: string | null;
  setStatus: (orgId: string, status: ProductsStatus) => void;
  clear: () => void;
};

export const useProductsStore = create<ProductsStore>((set) => ({
  status: null,
  orgId: null,
  setStatus: (orgId, status) => set({ orgId, status }),
  clear: () => set({ status: null, orgId: null }),
}));
