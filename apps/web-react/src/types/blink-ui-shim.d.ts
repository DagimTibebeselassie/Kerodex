declare module '@blinkdotnew/ui' {
  import type { ComponentType, ReactNode } from 'react';

  export const BlinkUIProvider: ComponentType<{ children?: ReactNode; theme?: string }>;
  export const Toaster: ComponentType<any>;
  export const Button: ComponentType<any>;
  export const Input: ComponentType<any>;
  export const Textarea: ComponentType<any>;
  export const Select: ComponentType<any>;
  export const SelectTrigger: ComponentType<any>;
  export const SelectContent: ComponentType<any>;
  export const SelectItem: ComponentType<any>;
  export const SelectValue: ComponentType<any>;
  export const Badge: ComponentType<any>;
  export const Dialog: ComponentType<any>;
  export const DialogContent: ComponentType<any>;
  export const DialogHeader: ComponentType<any>;
  export const DialogTitle: ComponentType<any>;
  export const Separator: ComponentType<any>;
  export const Stat: ComponentType<any>;
  export const StatGroup: ComponentType<any>;
  export const DataTable: ComponentType<any>;
  export const EmptyState: ComponentType<any>;
  export const toast: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
}
