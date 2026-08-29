import type { ButtonHTMLAttributes, ReactElement } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const buttonClassName = (variant: ButtonVariant = "primary"): string =>
  `button button--${variant}`;

export type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>;

export const Button = ({
  className,
  variant,
  ...props
}: ButtonProps): ReactElement => (
  <button
    {...props}
    className={[buttonClassName(variant), className].filter(Boolean).join(" ")}
  />
);
