import React, { useEffect, useRef, useState } from "react";

export function DropdownMenu({ children }) {
  return <div className="relative inline-block text-left">{children}</div>;
}
export function DropdownMenuTrigger({ children }) {
  return <div tabIndex={0} className="outline-none">{children}</div>;
}
export function DropdownMenuContent({ children, align = "start", className = "" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const t = triggerRef.current?.parentElement;
    if (!t) return;
    const toggle = () => setOpen((v) => !v);
    t.addEventListener("click", toggle);
    return () => t.removeEventListener("click", toggle);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!contentRef.current) return;
      if (!contentRef.current.contains(e.target) && !contentRef.current.previousSibling?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <>
      <span ref={triggerRef} className="sr-only" />
      {open && (
        <div
          ref={contentRef}
          className={`absolute mt-2 w-60 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 ${
            align === "end" ? "right-0" : "left-0"
          } ${className}`}
          role="menu"
        >
          {children}
        </div>
      )}
    </>
  );
}
export function DropdownMenuItem({ asChild, children, className = "", onClick }) {
  const base =
    "w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-slate-100 cursor-pointer flex items-center gap-2";
  if (asChild) {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      className: `${base} ${child.props.className || ""} ${className}`,
      onClick: (e) => { child.props.onClick?.(e); onClick?.(e); },
      role: "menuitem",
    });
  }
  return (
    <button onClick={onClick} className={`${base} ${className}`} role="menuitem">
      {children}
    </button>
  );
}
export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-slate-200" role="separator" />;
}
