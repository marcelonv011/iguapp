// src/ui/sheet.jsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Root
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

// Fondo oscuro
const SheetOverlay = React.forwardRef(function SheetOverlay(
  { className, ...props },
  ref
) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
});

// Contenido deslizable desde la derecha
const SheetContent = React.forwardRef(function SheetContent(
  { className, children, ...props },
  ref
) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-white shadow-xl",
          "border-l border-slate-200",
          "animate-in slide-in-from-right duration-300",
          "flex flex-col",
          className
        )}
        {...props}
      >
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        <SheetClose className="absolute right-4 top-4 rounded-full p-1 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </SheetClose>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

// Header / Title / Description / Footer helpers
function SheetHeader({ className, ...props }) {
  return (
    <div
      className={cn("mb-4 flex flex-col space-y-1.5 text-left", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-slate-600", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "border-t border-slate-200 mt-4 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2",
        className
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
};
