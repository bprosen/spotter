import { useRouter } from "@tanstack/react-router";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

/**
 * Run a server function with pending state and error/success toasts. After a successful write the router is
 * invalidated so every visible loader (including the root snapshot) re-reads the database.
 */
export function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: {
      success?: string | null | ((data: T | undefined) => string | null);
      onSuccess?: (data: T | undefined) => unknown;
    } = {},
  ) {
    startTransition(async () => {
      let res: ActionResult<T>;
      try {
        res = await action();
      } catch {
        toast.error("Couldn't reach the server. Is it running?");
        return;
      }
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const msg = typeof opts.success === "function" ? opts.success(res.data) : opts.success;
      if (msg) toast.success(msg);
      await opts.onSuccess?.(res.data);
      await router.invalidate();
    });
  }

  return { pending, run };
}
