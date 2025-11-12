// src/components/ui/popover.jsx
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * API compatible con:
 *  <Popover defaultOpen={false} open={...} onOpenChange={...}>
 *    <PopoverTrigger>...</PopoverTrigger>
 *    <PopoverContent align="start" side="bottom" sideOffset={8} className="...">...</PopoverContent>
 *  </Popover>
 */

const PopoverCtx = createContext(null);

export function Popover({ children, open, defaultOpen = false, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = (v) => {
    if (!isControlled) setUncontrolledOpen(v);
    if (onOpenChange) onOpenChange(v);
  };

  const triggerRef = useRef(null);

  const value = useMemo(
    () => ({ isOpen, setOpen, triggerRef }),
    [isOpen]
  );

  // Cerrar con ESC global
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return <PopoverCtx.Provider value={value}>{children}</PopoverCtx.Provider>;
}

export function PopoverTrigger({ children, asChild = false }) {
  const ctx = useContext(PopoverCtx);
  if (!ctx) throw new Error("PopoverTrigger debe estar dentro de <Popover>");
  const { isOpen, setOpen, triggerRef } = ctx;

  const child = asChild && React.isValidElement(children) ? children : null;

  const props = {
    ref: triggerRef,
    "aria-haspopup": "dialog",
    "aria-expanded": isOpen,
    onClick: (e) => {
      if (child?.props?.onClick) child.props.onClick(e);
      setOpen(!isOpen);
    },
  };

  if (child) {
    return React.cloneElement(child, {
      ...props,
      className: [child.props.className].filter(Boolean).join(" "),
    });
  }

  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className = "",
  align = "center", // "start" | "center" | "end"
  side = "bottom",  // "bottom" | "top" | "left" | "right"
  sideOffset = 8,
  onInteractOutside,
  style,
}) {
  const ctx = useContext(PopoverCtx);
  if (!ctx) throw new Error("PopoverContent debe estar dentro de <Popover>");
  const { isOpen, setOpen, triggerRef } = ctx;

  const contentRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Cerrar clic afuera
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e) => {
      const t = triggerRef.current;
      const c = contentRef.current;
      if (!c || !t) return;
      if (c.contains(e.target) || t.contains(e.target)) return;
      if (onInteractOutside) onInteractOutside(e);
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen, onInteractOutside, setOpen, triggerRef]);

  // Recalcular posición
  useLayoutEffect(() => {
    const t = triggerRef.current;
    const c = contentRef.current;
    if (!isOpen || !t || !c) return;

    const tb = t.getBoundingClientRect();
    const cb = c.getBoundingClientRect();

    let top = 0;
    let left = 0;

    // Side
    if (side === "bottom") top = tb.bottom + sideOffset + window.scrollY;
    if (side === "top") top = tb.top - cb.height - sideOffset + window.scrollY;
    if (side === "left") top = tb.top + (tb.height - cb.height) / 2 + window.scrollY;
    if (side === "right") top = tb.top + (tb.height - cb.height) / 2 + window.scrollY;

    if (side === "bottom" || side === "top") {
      if (align === "start") left = tb.left + window.scrollX;
      if (align === "center") left = tb.left + tb.width / 2 - cb.width / 2 + window.scrollX;
      if (align === "end") left = tb.right - cb.width + window.scrollX;
    } else {
      if (side === "left") left = tb.left - cb.width - sideOffset + window.scrollX;
      if (side === "right") left = tb.right + sideOffset + window.scrollX;
    }

    setCoords({ top, left });
  }, [isOpen, align, side, sideOffset]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={contentRef}
      role="dialog"
      style={{ top: coords.top, left: coords.left, position: "absolute", ...style }}
      className={[
        "z-50 rounded-lg border border-gray-200 bg-white shadow-xl",
        "p-3",
        "animate-in fade-in zoom-in-95",
        className,
      ].join(" ")}
    >
      {children}
    </div>,
    document.body
  );
}
