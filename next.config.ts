import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tfjs-node (used server-side in src/lib/server/faceEngine.ts) pulls in
  // @mapbox/node-pre-gyp, whose optional cloud-download path requires
  // aws-sdk/mock-aws-s3/nock. Those are never hit at runtime (models are
  // loaded from local files), but Next's bundler still tries to resolve them
  // statically unless this package is kept external and required natively.
  serverExternalPackages: ["@tensorflow/tfjs-node"],

  // @tensorflow/tfjs-core ships two independent builds (CJS "main" vs ESM
  // "module"), each with its own Tensor class. face-api.js's CJS require()
  // resolves one; an ESM import (e.g. @tensorflow/tfjs-backend-webgl, used
  // client-side in src/lib/client/faceDetection.ts) resolves the other.
  // A tensor created under one build isn't recognized by the other's
  // prototype methods, surfacing as errors like "t.toFloat is not a
  // function". Force every import of tfjs-core to the same physical file
  // so there's exactly one Tensor class in the bundle.
  turbopack: {
    resolveAlias: {
      "@tensorflow/tfjs-core": "@tensorflow/tfjs-core/dist/tf-core.node.js",
    },
  },
};

export default nextConfig;
