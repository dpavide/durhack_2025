export default function Container({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`container-px ${className}`} {...props} />;
}
