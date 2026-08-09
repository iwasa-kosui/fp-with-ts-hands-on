import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const buttonClassName = (variant: ButtonVariant = "primary"): string =>
  `button button--${variant}`;

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant,
  ...props
}, ref) => (
  <button
    {...props}
    className={[buttonClassName(variant), className].filter(Boolean).join(" ")}
    ref={ref}
  />
));
