import type { ReactNode } from "react";

/**
 * Reliable file picker for phones and desktops.
 * - A <label> wraps a visually hidden (not display:none) input: tapping works in Android WebView,
 *   iOS Safari and sandboxed iframes, where programmatic `input.click()` on a hidden input may be ignored.
 * - Android cannot map exotic extensions (.schem, .litematic, .nbt…) to MIME types and greys out every
 *   file when `accept` lists only them, so on touch devices no filter is applied; the file type is
 *   detected from its content after picking.
 */
export function FilePicker({
  accept,
  onFile,
  disabled,
  className = "btn primary big",
  children,
  testId,
}: {
  accept: string;
  onFile: (f: File | undefined) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  let coarse = false;
  try {
    coarse = matchMedia("(pointer: coarse)").matches;
  } catch {
    /* ignore */
  }
  return (
    <label className={`${className} file-picker ${disabled ? "is-disabled" : ""}`} aria-disabled={disabled}>
      <input
        type="file"
        className="file-input"
        accept={coarse ? undefined : accept}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}
