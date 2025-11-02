import Link from "next/link";

type BaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: false };
type LinkProps = React.ComponentProps<typeof Link> & { asChild: true; variant?: "primary" | "outline" };

type Props = (BaseProps & { variant?: "primary" | "outline" }) | LinkProps;

export default function Button(props: Props) {
  const variant = ("variant" in props && props.variant) || "primary";
  const cls = `btn ${variant === "primary" ? "btn-primary" : "btn-outline"}`;

  if ("asChild" in props && props.asChild) {
    const { className = "", variant: _v, asChild, ...rest } = props as LinkProps;
    return <Link className={`${cls} ${className}`} {...rest} />;
  }
  const { className = "", ...rest } = props as BaseProps;
  return <button className={`${cls} ${className}`} {...rest} />;
}
