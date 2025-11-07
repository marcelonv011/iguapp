export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={`p-6 ${className}`} {...props} />;
}
