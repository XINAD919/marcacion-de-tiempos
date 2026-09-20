import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tfjs-node (used server-side in src/lib/server/faceEngine.ts) pulls in
  // @mapbox/node-pre-gyp, whose optional cloud-download path requires
  // aws-sdk/mock-aws-s3/nock. Those are never hit at runtime (models are
  // loaded from local files), but Next's bundler still tries to resolve them
  // statically unless this package is kept external and required natively.
  serverExternalPackages: ["@tensorflow/tfjs-node"],
};

export default nextConfig;
