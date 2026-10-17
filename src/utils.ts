import OBR from "@owlbear-rodeo/sdk";

// Owlbear's SDK rejects with whatever the host sent (often a plain object with
// a message), not always an Error.
export const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const o = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error?.message === "string") return o.error.message;
    try {
      return JSON.stringify(err);
    } catch {
      return "unknown error";
    }
  }
  return String(err);
};

// OBR notifications are async and can fail; there's nowhere left to report
// that except the console, but it must never become an unhandled rejection.
export const notify = (
  message: string,
  variant: "DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING" = "DEFAULT",
) => {
  OBR.notification
    .show(message, variant)
    .catch((err) => console.error(`Notification failed: ${errorMessage(err)}`, message));
};
