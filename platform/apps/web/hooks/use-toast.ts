// Simplified version of shadcn/ui use-toast
import * as React from "react";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: string;
};

type ToastOptions = Omit<ToastItem, "id">;

export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback(({ title, description, variant }: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, description, variant };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);

    return {
      id,
      dismiss: () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      update: (props: Partial<ToastOptions>) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...props } : t)));
      },
    };
  }, []);

  return { toast, toasts };
};
