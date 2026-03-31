type Props = {
  size?: number;
  className?: string;
};

/** Decorative logo; pair with visible app name for accessibility. */
export default function BrandMark({ size = 40, className }: Props) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  );
}
