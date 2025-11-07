export function Button({ className = "", variant = "primary", size = "md", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98]";
  const sizes = {
    lg: "h-12 px-6 text-base",
    md: "h-10 px-5 text-sm",
    sm: "h-9 px-4 text-sm",
    icon: "h-10 w-10",
  };
  const variants = {
    primary:
      "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:brightness-110",
    outline:
      "border border-slate-300 text-slate-800 hover:bg-slate-50/80",
    ghost:
      "text-slate-700 hover:bg-slate-100/80",
    white:
      "bg-white text-slate-900 shadow-md hover:shadow-lg",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
