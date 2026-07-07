import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // No org/project set — build-time source-map upload to Sentry is skipped
  // until SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are configured. Error
  // reporting itself (via the DSN) works independently of this.
});
