export default function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card p-6 ${className}`} {...props} />;
}
