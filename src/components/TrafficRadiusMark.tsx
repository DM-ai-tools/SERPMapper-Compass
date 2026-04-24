import { TrafficRadiusLogoImage } from "./TrafficRadiusLogoImage";

/**
 * Traffic Radius wordmark: official logo asset (left side of the nav + report header).
 */
export default function TrafficRadiusMark() {
  return (
    <a
      href="https://trafficradius.com.au/"
      className="group flex shrink-0 items-center"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Traffic Radius"
    >
      <TrafficRadiusLogoImage
        priority
        className="h-8 w-auto max-h-9 max-w-[min(100%,14rem)] object-contain object-left sm:h-9"
      />
    </a>
  );
}
