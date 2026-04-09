import { APP_LOGO_PATH } from "@/lib/appMeta";

type Props = {
  size?: number;
  className?: string;
};

/** Branch logo; pair with visible app name for accessibility. */
export default function BrandMark({ size = 40, className }: Props) {
  return (
    <img
      src={APP_LOGO_PATH}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  );
}
