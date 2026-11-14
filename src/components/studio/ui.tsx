"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover border-transparent font-semibold",
  secondary: "bg-raised text-fg border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-muted border-transparent hover:bg-hover hover:text-fg",
  danger: "bg-transparent text-danger border-danger-line hover:bg-[#2a1519]",
  success: "bg-[#183a2e] text-[#d1fae5] border-transparent hover:bg-[#1f4a3a] font-medium",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-[13px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-7 px-2.5 text-xs rounded-md",
        size === "md" && "h-8 px-3",
        size === "lg" && "h-11 px-4 text-sm rounded-xl",
        variants[variant],
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  className,
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40",
        active && "bg-selected text-accent-soft",
        className ?? "size-7",
      )}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded border border-line-strong px-1.5 py-px font-sans text-[11px] text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "sm",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "lg";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex shrink-0 rounded-lg border border-[#1f2433] bg-[#161a23] p-0.5",
        size === "lg" && "rounded-xl p-[3px]",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 text-xs transition-colors",
            size === "sm" ? "h-6" : "h-[34px] rounded-[9px] px-3 text-[13px]",
            value === o.value ? "bg-[#2a2f42] text-white" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      "[data-autofocus], input, textarea, select, button:not([data-close])",
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const items = [
          ...ref.current.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])",
          ),
        ];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-panel shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-6xl" : "sm:max-w-md",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <IconButton label="Close" data-close onClick={onClose} className="size-8">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-medium text-soft">{label}</span>
      {children}
      {hint && <span className="text-xs text-dim">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-[13px] text-fg placeholder:text-dim outline-none focus:border-accent";

export function FileBadge({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, [string, string]> = {
    tsx: ["TSX", "text-[#60a5fa]"],
    ts: ["TS", "text-[#60a5fa]"],
    jsx: ["JSX", "text-[#fcd34d]"],
    js: ["JS", "text-[#fcd34d]"],
    mjs: ["JS", "text-[#fcd34d]"],
    css: ["#", "text-[#c084fc] text-xs"],
    html: ["<>", "text-[#fb923c]"],
    htm: ["<>", "text-[#fb923c]"],
    php: ["PHP", "text-[#a5b4fc]"],
    json: ["{}", "text-[#fbbf24] text-[11px]"],
    md: ["MD", "text-soft"],
  };
  const [text, color] = map[ext] || ["•", "text-muted"];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-[22px] shrink-0 text-center text-[9px] font-bold", color)}
    >
      {text}
    </span>
  );
}
