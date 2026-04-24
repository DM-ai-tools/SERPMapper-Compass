/** Public asset: `public/Traffic-Radius-Logo.webp` */
export const TRAFFIC_RADIUS_LOGO_SRC = "/Traffic-Radius-Logo.webp";

type Props = {
  className?: string;
  /** LCP: set on first-viewport headers */
  priority?: boolean;
};

export function TrafficRadiusLogoImage({ className, priority }: Props) {
  return (
    <img
      src={TRAFFIC_RADIUS_LOGO_SRC}
      alt="Traffic Radius"
      width={200}
      height={48}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
