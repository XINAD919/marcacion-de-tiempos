# Reconocimiento facial con face-api.js (arquitectura híbrida) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the face-api.js recognition engine (client-side live guidance + server-side descriptor extraction and matching) with real SQL Server persistence, end to end from enrollment to marcación, following TDD layer by layer.

**Architecture:** Hybrid split — the browser runs only `TinyFaceDetector` for live oval-guide feedback and frame capture; a Next.js Route Handler decodes the captured JPEG with `@tensorflow/tfjs-node` + `canvas`, extracts the real 128-length descriptor with `face_landmark_68` + `face_recognition`, and matches it against embeddings stored in SQL Server via Prisma using face-api.js's own `FaceMatcher`.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), TypeScript, face-api.js 0.22.2, `@tensorflow/tfjs-node`, `canvas`, Prisma (`sqlserver` provider), Docker Compose (SQL Server 2022 for local dev), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-face-api-js-hibrido-design.md` — read it first, this plan implements it task by task.

---

## Before you start

- Package manager is `pnpm` (`pnpm-lock.yaml` present). Use `pnpm`, not `npm`/`yarn`, for every command below.
- `package.json` already lists `face-api.js`, `@tensorflow/tfjs-node`, and `canvas` as dependencies — Task 1 fixes a real, already-confirmed problem: the `canvas` native binding does not currently load on this machine.
- `AGENTS.md` at the repo root documents the product/design decisions this plan implements. It also carries a block (between `<!-- BEGIN:nextjs-agent-rules -->` / `END`) reminding that this Next.js version has breaking changes vs. training data — this plan was written after reading the relevant guides under `node_modules/next/dist/docs/`, cited inline where it mattered (dynamic route `params` are now a `Promise`; Edge Runtime is deprecated so `nodejs` is the only runtime, no explicit `export const runtime` needed).

---

### Task 1: Fix the `canvas` native build on this machine

**Files:** none (system packages only).

- [ ] **Step 1: Confirm the current failure**

Run: `node -e "require('canvas')"`
Expected: `Error: Cannot find module '../build/Release/canvas.node'` (confirms the native binding never compiled — `libcairo2-dev`/`libpango1.0-dev` headers are missing, only the runtime `.so` is installed).

- [ ] **Step 2: Install the system libraries `node-canvas` needs to build**

Run:
```bash
sudo apt-get update && sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev pkg-config
```

- [ ] **Step 3: Rebuild the `canvas` native binding**

Run: `pnpm rebuild canvas`
Expected: build output ends without errors (no `gyp ERR!` lines).

- [ ] **Step 4: Verify it loads now**

Run: `node -e "console.log(Object.keys(require('canvas')))"`
Expected: prints an array of exports including `Canvas`, `Image`, `ImageData`, `loadImage` — no `MODULE_NOT_FOUND`.

No commit for this task — no repository files changed. If Task 4 still fails, stop and re-check `pkg-config --exists cairo` / `pkg-config --exists pango` before continuing; every later task that touches `faceEngine.ts` depends on this working.

---

### Task 2: Move `app/` to `src/app/`

`AGENTS.md`'s "Estructura de carpetas sugerida" puts everything under `src/`, but the project was scaffolded with `app/` at the root. Do this now, before adding more files, so nothing has to move twice.

**Files:**
- Move: `app/` → `src/app/` (`favicon.ico`, `globals.css`, `layout.tsx`, `page.tsx`)
- Modify: `tsconfig.json:21-23`

- [ ] **Step 1: Move the directory with git so history follows the files**

Run:
```bash
mkdir -p src && git mv app src/app
```

- [ ] **Step 2: Point the `@/*` path alias at `src/`**

In `tsconfig.json`, change:
```json
    "paths": {
      "@/*": ["./*"]
    }
```
to:
```json
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [ ] **Step 3: Verify the app still builds**

Run: `pnpm build`
Expected: build succeeds and reports the routes from `src/app` (e.g. `/`), no "no pages/app directory found" error.

- [ ] **Step 4: Commit**

```bash
git add src app tsconfig.json
git commit -m "Move app/ to src/app per AGENTS.md folder structure"
```

---

### Task 3: Install and configure Vitest

**Files:**
- Modify: `package.json` (devDependency + scripts)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run: `pnpm add -D vitest`

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Every test in this plan exercises Node-side logic (matching math, model inference, Route Handlers) rather than rendering React components, so `environment: "node"` is used instead of the `jsdom` default shown in Next.js's own Vitest guide — this also avoids `jsdom`'s `Canvas`/`Image` globals colliding with the ones `node-canvas` installs for face-api.js. The `resolve.alias` entry is required, not optional: Tasks 8 and 9's Route Handlers and their tests import from `@/lib/server/...`, and unlike Next.js's own bundler, Vitest does not read `tsconfig.json`'s `paths` automatically — without this alias those imports fail to resolve under `vitest`.

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works with no tests yet**

Run: `pnpm test`
Expected: `No test files found` (harness runs, nothing to run yet — that's expected at this point).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "Add Vitest test runner"
```

---

### Task 4: Prisma + local SQL Server (Docker Compose) + schema

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `vitest.setup.ts`
- Modify: `package.json` (`prisma`, `@prisma/client`), `.gitignore` (`.env*` already ignores `.env.example`, needs a negation), `vitest.config.ts` (load `.env` before tests run)

- [ ] **Step 1: Install Prisma**

Run:
```bash
pnpm add -D prisma
pnpm add @prisma/client
```

- [ ] **Step 2: Add SQL Server to Docker Compose**

Create `docker-compose.yml`:
```yaml
services:
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "${SA_PASSWORD}"
    ports:
      - "1433:1433"
    volumes:
      - mssql-data:/var/opt/mssql

volumes:
  mssql-data:
```

- [ ] **Step 3: Add environment variable examples**

Create `.env.example`:
```
SA_PASSWORD="ChangeMe_Str0ng!"
DATABASE_URL="sqlserver://localhost:1433;database=medicion_tiempos;user=sa;password=ChangeMe_Str0ng!;trustServerCertificate=true"
FACE_MATCH_THRESHOLD=0.5
```

Copy it to a real `.env` and change both passwords to the same value:
```bash
cp .env.example .env
```

`.gitignore` already has a blanket `.env*` rule, which also matches (and hides) `.env.example` — add a negation so the example file can still be committed:
```bash
grep -qx '!.env.example' .gitignore || echo '!.env.example' >> .gitignore
```

- [ ] **Step 4: Make Vitest load `.env` before tests run**

Tasks 8 and 9 add tests that hit the real database through Prisma, which reads `DATABASE_URL` from `process.env`. Node 20+ can load an env file natively — no `dotenv` dependency needed.

Create `vitest.setup.ts`:
```ts
process.loadEnvFile(".env");
```

In `vitest.config.ts` (created in Task 3), add `setupFiles`:
```ts
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
```

- [ ] **Step 5: Write the Prisma schema**

Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model User {
  id            String          @id @default(uuid())
  cedula        String          @unique
  nombre        String
  email         String
  universidad   String
  entidad       String
  activo        Boolean         @default(true)
  fechaRegistro DateTime        @default(now())
  embeddings    FaceEmbedding[]
  attendance    AttendanceLog[]
}

model FaceEmbedding {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  embedding    Bytes
  modelo       String
  fechaCaptura DateTime @default(now())
}

model AttendanceLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tipo      String
  metodo    String
  confianza Float?
  deviceId  String
  marcadoEn DateTime @default(now())
}
```

- [ ] **Step 6: Start the local database**

Run: `docker compose up -d db`
Expected: container `medicion-tiempos-db-1` (or similar) reports `Started`. SQL Server inside the container takes ~15-30s to accept connections after that — the next step will simply fail and can be retried if run too early.

- [ ] **Step 7: Run the first migration**

Run: `pnpm exec prisma migrate dev --name init`
Expected: `Your database is now in sync with your schema` and a generated `@prisma/client`. If it fails with a connection error, wait 15s and re-run — SQL Server is still starting up.

- [ ] **Step 8: Verify Vitest now loads the environment (no test files yet, but the setup file must not error)**

Run: `pnpm test`
Expected: `No test files found` — same as Task 3's check, just confirming `vitest.setup.ts` didn't break the run now that `.env` exists.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml docker-compose.yml .env.example .gitignore prisma vitest.config.ts vitest.setup.ts
git commit -m "Add Prisma schema, local SQL Server via Docker Compose, and env loading for tests"
```

---

### Task 5: `faceMatcher.ts` — matching logic (Layer 1, pure/mocked)

This is the first real TDD cycle: the matching decision (which user, if any, a descriptor belongs to) is pure array math wrapped around Prisma reads/writes, so it's tested with a mocked Prisma client — no models, no DB, no fixture photos needed.

**Files:**
- Create: `src/lib/server/prisma.ts`
- Create: `src/lib/server/faceMatcher.ts`
- Test: `src/lib/server/faceMatcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/faceMatcher.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const create = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    faceEmbedding: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import {
  bufferToDescriptor,
  descriptorToBuffer,
  findMatch,
  saveEnrollmentDescriptor,
} from "./faceMatcher";

function fakeDescriptor(fill: number): Float32Array {
  return new Float32Array(128).fill(fill);
}

describe("descriptorToBuffer / bufferToDescriptor", () => {
  it("round-trips a descriptor through a buffer without losing precision", () => {
    const original = fakeDescriptor(0.42);
    const roundTripped = bufferToDescriptor(descriptorToBuffer(original));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});

describe("findMatch", () => {
  beforeEach(() => {
    findMany.mockReset();
    create.mockReset();
    delete process.env.FACE_MATCH_THRESHOLD;
  });

  it("returns the matching userId when a stored descriptor is close enough", async () => {
    const stored = fakeDescriptor(0.1);
    findMany.mockResolvedValue([{ userId: "user-1", embedding: descriptorToBuffer(stored) }]);

    const result = await findMatch(fakeDescriptor(0.1));

    expect(result).toEqual({ userId: "user-1", distance: 0 });
  });

  it("returns null when no stored descriptor is within the threshold", async () => {
    const stored = fakeDescriptor(0.1);
    findMany.mockResolvedValue([{ userId: "user-1", embedding: descriptorToBuffer(stored) }]);

    const result = await findMatch(fakeDescriptor(5));

    expect(result).toBeNull();
  });

  it("returns null when there are no enrolled users", async () => {
    findMany.mockResolvedValue([]);

    const result = await findMatch(fakeDescriptor(0.1));

    expect(result).toBeNull();
  });
});

describe("saveEnrollmentDescriptor", () => {
  it("persists the descriptor as a buffer via prisma", async () => {
    create.mockResolvedValue(undefined);
    const descriptor = fakeDescriptor(0.2);

    await saveEnrollmentDescriptor("user-1", descriptor, "face-api-recognition-v1");

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        embedding: descriptorToBuffer(descriptor),
        modelo: "face-api-recognition-v1",
      },
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm test faceMatcher`
Expected: FAIL — `Cannot find module './prisma'` or `'./faceMatcher'` (neither file exists yet).

- [ ] **Step 3: Create the Prisma client singleton**

Create `src/lib/server/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Implement `faceMatcher.ts`**

Create `src/lib/server/faceMatcher.ts`:
```ts
import * as faceapi from "face-api.js";
import { prisma } from "./prisma";

export const DEFAULT_MATCH_THRESHOLD = 0.5;

function getMatchThreshold(): number {
  const raw = process.env.FACE_MATCH_THRESHOLD;
  return raw ? Number(raw) : DEFAULT_MATCH_THRESHOLD;
}

export function descriptorToBuffer(descriptor: Float32Array): Buffer {
  return Buffer.from(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);
}

export function bufferToDescriptor(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

export interface MatchResult {
  userId: string;
  distance: number;
}

export async function findMatch(descriptor: Float32Array): Promise<MatchResult | null> {
  const rows = await prisma.faceEmbedding.findMany({
    where: { user: { activo: true } },
    select: { userId: true, embedding: true },
  });

  if (rows.length === 0) return null;

  const byUser = new Map<string, Float32Array[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(bufferToDescriptor(row.embedding as Buffer));
    byUser.set(row.userId, list);
  }

  const labeled = Array.from(byUser.entries()).map(
    ([userId, descriptors]) => new faceapi.LabeledFaceDescriptors(userId, descriptors)
  );

  const matcher = new faceapi.FaceMatcher(labeled, getMatchThreshold());
  const best = matcher.findBestMatch(descriptor);

  if (best.label === "unknown") return null;
  return { userId: best.label, distance: best.distance };
}

export async function saveEnrollmentDescriptor(
  userId: string,
  descriptor: Float32Array,
  modelo: string
): Promise<void> {
  await prisma.faceEmbedding.create({
    data: { userId, embedding: descriptorToBuffer(descriptor), modelo },
  });
}
```

- [ ] **Step 5: Run the tests again and confirm they pass**

Run: `pnpm test faceMatcher`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/prisma.ts src/lib/server/faceMatcher.ts src/lib/server/faceMatcher.test.ts
git commit -m "Add face descriptor matching against SQL Server via Prisma"
```

---

### Task 6: Download the face-api.js model weights

**Files:**
- Create: `public/models/tiny_face_detector_model-weights_manifest.json`, `public/models/tiny_face_detector_model-shard1`
- Create: `public/models/face_landmark_68_model-weights_manifest.json`, `public/models/face_landmark_68_model-shard1`
- Create: `public/models/face_recognition_model-weights_manifest.json`, `public/models/face_recognition_model-shard1`, `public/models/face_recognition_model-shard2`

- [ ] **Step 1: Download the three model sets from the canonical face-api.js weights repo**

Run:
```bash
mkdir -p public/models
BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master"
for f in \
  tiny_face_detector/tiny_face_detector_model-weights_manifest.json \
  tiny_face_detector/tiny_face_detector_model-shard1 \
  face_landmark_68/face_landmark_68_model-weights_manifest.json \
  face_landmark_68/face_landmark_68_model-shard1 \
  face_recognition/face_recognition_model-weights_manifest.json \
  face_recognition/face_recognition_model-shard1 \
  face_recognition/face_recognition_model-shard2 \
; do
  curl -fL "$BASE/$f" -o "public/models/$(basename "$f")"
done
```

- [ ] **Step 2: Verify all 7 files downloaded and the manifests are valid JSON**

Run:
```bash
ls public/models
node -e "JSON.parse(require('fs').readFileSync('public/models/tiny_face_detector_model-weights_manifest.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/models/face_landmark_68_model-weights_manifest.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/models/face_recognition_model-weights_manifest.json'))"
```
Expected: 7 files listed, no output/errors from the three `node -e` calls (a parse error means a download returned an HTML error page instead of JSON — re-run `curl` for that file).

- [ ] **Step 3: Commit**

```bash
git add public/models
git commit -m "Add face-api.js model weights (tiny face detector, landmarks, recognition)"
```

---

### Task 7: `faceEngine.ts` — real descriptor extraction (Layer 2, real models + fixtures)

**Prerequisite (blocking, do this before Step 4 below):** this layer needs real face photos checked into `test/fixtures/faces/`. Provide, at these exact paths:

- `persona-a-1.jpg` and `persona-a-2.jpg` — two different photos of the same person (e.g., two selfies of Daniel taken a few minutes apart, different angle/lighting).
- `persona-b-1.jpg` — one photo of a different person.
- `sin-rostro.jpg` — any photo with no face in it (a wall, a landscape, an object).
- `varios-rostros.jpg` — one photo with two or more faces in it.

```bash
mkdir -p test/fixtures/faces
```

**Files:**
- Create: `src/lib/server/faceEngine.ts`
- Test: `src/lib/server/faceEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/faceEngine.test.ts`:
```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as faceapi from "face-api.js";
import { describe, expect, it } from "vitest";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "./faceEngine";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

describe("getFaceDescriptor", () => {
  it(
    "returns a 128-length descriptor for a photo with exactly one face",
    async () => {
      const descriptor = await getFaceDescriptor(await loadFixture("persona-a-1.jpg"));
      expect(descriptor).toBeInstanceOf(Float32Array);
      expect(descriptor.length).toBe(128);
    },
    20000
  );

  it(
    "produces a descriptor closer to the same person than to a different one",
    async () => {
      const a1 = await getFaceDescriptor(await loadFixture("persona-a-1.jpg"));
      const a2 = await getFaceDescriptor(await loadFixture("persona-a-2.jpg"));
      const b1 = await getFaceDescriptor(await loadFixture("persona-b-1.jpg"));

      const distanceSamePerson = faceapi.euclideanDistance(a1, a2);
      const distanceDifferentPerson = faceapi.euclideanDistance(a1, b1);

      expect(distanceSamePerson).toBeLessThan(distanceDifferentPerson);
    },
    20000
  );

  it(
    "throws NoFaceDetectedError when the photo has no face",
    async () => {
      await expect(getFaceDescriptor(await loadFixture("sin-rostro.jpg"))).rejects.toBeInstanceOf(
        NoFaceDetectedError
      );
    },
    20000
  );

  it(
    "throws MultipleFacesDetectedError when the photo has more than one face",
    async () => {
      await expect(
        getFaceDescriptor(await loadFixture("varios-rostros.jpg"))
      ).rejects.toBeInstanceOf(MultipleFacesDetectedError);
    },
    20000
  );
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm test faceEngine`
Expected: FAIL — `Cannot find module './faceEngine'`.

- [ ] **Step 3: Implement `faceEngine.ts`**

Create `src/lib/server/faceEngine.ts`:
```ts
import path from "node:path";
import "@tensorflow/tfjs-node";
import { Canvas, Image, ImageData, loadImage } from "canvas";
import * as faceapi from "face-api.js";

faceapi.env.monkeyPatch({
  Canvas: Canvas as unknown as typeof HTMLCanvasElement,
  Image: Image as unknown as typeof HTMLImageElement,
  ImageData: ImageData as unknown as typeof globalThis.ImageData,
});

const MODELS_PATH = path.join(process.cwd(), "public", "models");

let modelsLoaded: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsLoaded) {
    modelsLoaded = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH),
    ]).then(() => undefined);
  }
  return modelsLoaded;
}

export class NoFaceDetectedError extends Error {
  constructor() {
    super("No se detectó ningún rostro");
    this.name = "NoFaceDetectedError";
  }
}

export class MultipleFacesDetectedError extends Error {
  constructor() {
    super("Se detectaron varios rostros");
    this.name = "MultipleFacesDetectedError";
  }
}

export async function getFaceDescriptor(imageBuffer: Buffer): Promise<Float32Array> {
  await loadModels();
  const image = await loadImage(imageBuffer);

  const detections = await faceapi
    .detectAllFaces(image as unknown as HTMLImageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) throw new NoFaceDetectedError();
  if (detections.length > 1) throw new MultipleFacesDetectedError();

  return detections[0].descriptor;
}
```

- [ ] **Step 4: Place the fixture photos** (see Prerequisite above), then run the tests

Run: `pnpm test faceEngine`
Expected: PASS, 4 tests (first run is slower — ~5-15s — while the ~7MB of model weights load and TensorFlow's native backend initializes; later runs in the same `vitest` process are fast because `loadModels()` caches the promise).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/faceEngine.ts src/lib/server/faceEngine.test.ts test/fixtures/faces
git commit -m "Add real face descriptor extraction with tfjs-node and canvas"
```

---

### Task 8: Route Handler `/api/marcacion` (Layer 3, real DB + real models)

**Files:**
- Create: `src/app/api/marcacion/route.ts`
- Test: `src/app/api/marcacion/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/marcacion/route.test.ts`:
```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getFaceDescriptor } from "@/lib/server/faceEngine";
import { descriptorToBuffer } from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";
import { POST } from "./route";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

function buildRequest(photo: Buffer, deviceId: string): Request {
  const formData = new FormData();
  formData.append("foto", new Blob([photo], { type: "image/jpeg" }), "foto.jpg");
  formData.append("deviceId", deviceId);
  return new Request("http://localhost/api/marcacion", { method: "POST", body: formData });
}

let userId: string;

beforeAll(async () => {
  const enrollmentDescriptor = await getFaceDescriptor(await loadFixture("persona-a-2.jpg"));

  const user = await prisma.user.create({
    data: {
      cedula: "TEST-0001",
      nombre: "Persona A de Prueba",
      email: "persona-a@example.com",
      universidad: "Universidad de Prueba",
      entidad: "Entidad de Prueba",
    },
  });
  userId = user.id;

  await prisma.faceEmbedding.create({
    data: {
      userId,
      embedding: descriptorToBuffer(enrollmentDescriptor),
      modelo: "face-api-recognition-v1",
    },
  });
}, 20000);

afterEach(async () => {
  await prisma.attendanceLog.deleteMany({ where: { userId } });
});

afterAll(async () => {
  await prisma.faceEmbedding.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

describe("POST /api/marcacion", () => {
  it(
    "marca IN la primera vez que reconoce a un usuario enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(true);
      expect(body.nombre).toBe("Persona A de Prueba");
      expect(body.tipo).toBe("IN");
    },
    20000
  );

  it(
    "responde matched:false para un rostro no enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-b-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(false);
    },
    20000
  );
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm test src/app/api/marcacion`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the route handler**

Create `src/app/api/marcacion/route.ts`:
```ts
import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { findMatch } from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const foto = formData.get("foto");
  const deviceId = formData.get("deviceId");

  if (!(foto instanceof Blob) || typeof deviceId !== "string") {
    return NextResponse.json(
      { error: "Falta la foto o el identificador del kiosko" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await foto.arrayBuffer());

  let descriptor: Float32Array;
  try {
    descriptor = await getFaceDescriptor(buffer);
  } catch (error) {
    if (error instanceof NoFaceDetectedError) {
      return NextResponse.json({ error: "No se detectó ningún rostro" }, { status: 422 });
    }
    if (error instanceof MultipleFacesDetectedError) {
      return NextResponse.json(
        { error: "Se detectaron varios rostros, asegúrate de estar solo frente a la cámara" },
        { status: 422 }
      );
    }
    throw error;
  }

  const match = await findMatch(descriptor);
  if (!match) {
    return NextResponse.json({ matched: false });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: match.userId } });
  const lastLogToday = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, marcadoEn: { gte: startOfToday() } },
    orderBy: { marcadoEn: "desc" },
  });

  const tipo = lastLogToday?.tipo === "IN" ? "OUT" : "IN";

  const log = await prisma.attendanceLog.create({
    data: { userId: user.id, tipo, metodo: "face", confianza: match.distance, deviceId },
  });

  return NextResponse.json({ matched: true, nombre: user.nombre, hora: log.marcadoEn.toISOString(), tipo });
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `pnpm test src/app/api/marcacion`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/marcacion
git commit -m "Add /api/marcacion route handler with real matching and attendance logging"
```

---

### Task 9: Route Handler `/api/usuarios/[userId]/enrolar` (Layer 3)

**Files:**
- Create: `src/app/api/usuarios/[userId]/enrolar/route.ts`
- Test: `src/app/api/usuarios/[userId]/enrolar/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/usuarios/[userId]/enrolar/route.test.ts`:
```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { POST } from "./route";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

function buildRequest(photo: Buffer): Request {
  const formData = new FormData();
  formData.append("foto", new Blob([photo], { type: "image/jpeg" }), "foto.jpg");
  return new Request("http://localhost/api/usuarios/x/enrolar", { method: "POST", body: formData });
}

async function createTestUser(cedula: string) {
  return prisma.user.create({
    data: {
      cedula,
      nombre: "Persona de Prueba",
      email: `${cedula}@example.com`,
      universidad: "Universidad de Prueba",
      entidad: "Entidad de Prueba",
    },
  });
}

describe("POST /api/usuarios/[userId]/enrolar", () => {
  it(
    "guarda un embedding cuando la foto tiene exactamente un rostro",
    async () => {
      const user = await createTestUser("TEST-0002");

      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg")), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(response.status).toBe(201);
      const embeddings = await prisma.faceEmbedding.findMany({ where: { userId: user.id } });
      expect(embeddings).toHaveLength(1);

      await prisma.faceEmbedding.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    },
    20000
  );

  it(
    "responde 422 cuando la foto no tiene rostro",
    async () => {
      const user = await createTestUser("TEST-0003");

      const response = await POST(buildRequest(await loadFixture("sin-rostro.jpg")), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(response.status).toBe(422);

      await prisma.user.delete({ where: { id: user.id } });
    },
    20000
  );
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm test src/app/api/usuarios`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the route handler**

Create `src/app/api/usuarios/[userId]/enrolar/route.ts`:
```ts
import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { saveEnrollmentDescriptor } from "@/lib/server/faceMatcher";

const MODEL_VERSION = "face-api-recognition-v1";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const formData = await request.formData();
  const foto = formData.get("foto");

  if (!(foto instanceof Blob)) {
    return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());

  try {
    const descriptor = await getFaceDescriptor(buffer);
    await saveEnrollmentDescriptor(userId, descriptor, MODEL_VERSION);
  } catch (error) {
    if (error instanceof NoFaceDetectedError) {
      return NextResponse.json({ error: "No se detectó ningún rostro" }, { status: 422 });
    }
    if (error instanceof MultipleFacesDetectedError) {
      return NextResponse.json(
        { error: "Se detectaron varios rostros, asegúrate de estar solo frente a la cámara" },
        { status: 422 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

Note: `params` is a `Promise` here, not a plain object — confirmed against this project's actual Next.js docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), since this version differs from older Next.js training data.

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `pnpm test src/app/api/usuarios`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/usuarios
git commit -m "Add /api/usuarios/[userId]/enrolar route handler"
```

---

### Task 10: `guideState.ts` — pure oval-guide logic (TDD)

The kiosk/enrollment oval needs to know, frame by frame, whether to stay waiting, show "detecting", or trigger a capture. That decision is pure state-transition logic and is extracted so it can be unit-tested without a browser, a webcam, or React.

**Files:**
- Create: `src/lib/client/guideState.ts`
- Test: `src/lib/client/guideState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/client/guideState.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { nextGuideState } from "./guideState";

describe("nextGuideState", () => {
  it("vuelve a esperando y resetea el contador cuando no hay rostro", () => {
    const result = nextGuideState({
      currentState: "detectando",
      faceDetected: false,
      stableFrameCount: 5,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "esperando", nextStableFrameCount: 0, shouldCapture: false });
  });

  it("pasa a detectando y suma un frame estable mientras no llega al umbral", () => {
    const result = nextGuideState({
      currentState: "esperando",
      faceDetected: true,
      stableFrameCount: 0,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "detectando", nextStableFrameCount: 1, shouldCapture: false });
  });

  it("pasa a listo y marca shouldCapture cuando alcanza el umbral de frames estables", () => {
    const result = nextGuideState({
      currentState: "detectando",
      faceDetected: true,
      stableFrameCount: 7,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "listo", nextStableFrameCount: 8, shouldCapture: true });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm test guideState`
Expected: FAIL — `Cannot find module './guideState'`.

- [ ] **Step 3: Implement `guideState.ts`**

Create `src/lib/client/guideState.ts`:
```ts
export type GuideState = "esperando" | "detectando" | "listo";

export interface GuideTransitionInput {
  currentState: GuideState;
  faceDetected: boolean;
  stableFrameCount: number;
  framesRequiredToCapture: number;
}

export interface GuideTransitionResult {
  nextState: GuideState;
  nextStableFrameCount: number;
  shouldCapture: boolean;
}

export function nextGuideState({
  faceDetected,
  stableFrameCount,
  framesRequiredToCapture,
}: GuideTransitionInput): GuideTransitionResult {
  if (!faceDetected) {
    return { nextState: "esperando", nextStableFrameCount: 0, shouldCapture: false };
  }

  const nextStableFrameCount = stableFrameCount + 1;

  if (nextStableFrameCount >= framesRequiredToCapture) {
    return { nextState: "listo", nextStableFrameCount, shouldCapture: true };
  }

  return { nextState: "detectando", nextStableFrameCount, shouldCapture: false };
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `pnpm test guideState`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/guideState.ts src/lib/client/guideState.test.ts
git commit -m "Add pure state machine for the kiosk face-guide oval"
```

---

### Task 11: Client detection module, hook, and minimal pages

This task is UI wiring around the already-tested pieces (`guideState.ts` client-side, the two route handlers server-side). It is verified manually/visually rather than with Vitest — matching the spec's Layer 4 (automated tests can't meaningfully assert on live webcam recognition accuracy).

**Files:**
- Create: `src/lib/client/faceDetection.ts`
- Create: `src/lib/client/useFaceGuide.ts`
- Create: `src/app/marcacion/page.tsx`
- Create: `src/app/admin/enrolar/[userId]/page.tsx`

- [ ] **Step 1: Client-side detection wrapper**

Create `src/lib/client/faceDetection.ts`:
```ts
"use client";

import * as faceapi from "face-api.js";

let modelPromise: Promise<void> | null = null;

export function loadDetectionModel(modelUrl = "/models"): Promise<void> {
  if (!modelPromise) {
    modelPromise = faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
  }
  return modelPromise;
}

export async function detectFace(video: HTMLVideoElement): Promise<boolean> {
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
  return Boolean(detection);
}
```

- [ ] **Step 2: `useFaceGuide` hook**

Create `src/lib/client/useFaceGuide.ts`:
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectFace, loadDetectionModel } from "./faceDetection";
import { type GuideState, nextGuideState } from "./guideState";

const FRAMES_REQUIRED_TO_CAPTURE = 8;

export function useFaceGuide(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<GuideState>("esperando");
  const stableFrameCount = useRef(0);
  const capturedRef = useRef(false);

  const captureFrame = useCallback((video: HTMLVideoElement): Blob | null => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    let result: Blob | null = null;
    canvas.toBlob((blob) => {
      result = blob;
    }, "image/jpeg");
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frameHandle: number;

    loadDetectionModel().then(function loop() {
      if (cancelled) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || capturedRef.current) {
        frameHandle = requestAnimationFrame(loop);
        return;
      }

      detectFace(video).then((faceDetected) => {
        const result = nextGuideState({
          currentState: state,
          faceDetected,
          stableFrameCount: stableFrameCount.current,
          framesRequiredToCapture: FRAMES_REQUIRED_TO_CAPTURE,
        });

        stableFrameCount.current = result.nextStableFrameCount;
        setState(result.nextState);

        if (result.shouldCapture) {
          capturedRef.current = true;
        }

        frameHandle = requestAnimationFrame(loop);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  return { state, captureFrame, hasCaptured: capturedRef.current };
}
```

- [ ] **Step 3: Minimal kiosk page**

Create `src/app/marcacion/page.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

type Feedback = { nombre: string; hora: string; tipo: string } | { matched: false } | null;

export default function MarcacionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, captureFrame, hasCaptured } = useFaceGuide(videoRef);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    if (!hasCaptured || !videoRef.current) return;
    const blob = captureFrame(videoRef.current);
    if (!blob) return;

    const formData = new FormData();
    formData.append("foto", blob, "foto.jpg");
    formData.append("deviceId", "kiosko-1");

    fetch("/api/marcacion", { method: "POST", body: formData })
      .then((response) => response.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setFeedback(body);
      });
  }, [hasCaptured, captureFrame]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      {error && <p role="alert">{error}</p>}
      {feedback && "nombre" in feedback && (
        <p>
          {feedback.nombre} — {feedback.tipo} — {feedback.hora}
        </p>
      )}
      {feedback && "matched" in feedback && feedback.matched === false && <p>No reconocido</p>}
    </div>
  );
}
```

- [ ] **Step 4: Minimal enrollment page**

Create `src/app/admin/enrolar/[userId]/page.tsx`:
```tsx
"use client";

import { use, useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

export default function EnrolarPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, captureFrame, hasCaptured } = useFaceGuide(videoRef);
  const [capturas, setCapturas] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    if (!hasCaptured || !videoRef.current || capturas >= 5) return;
    const blob = captureFrame(videoRef.current);
    if (!blob) return;

    const formData = new FormData();
    formData.append("foto", blob, "foto.jpg");

    fetch(`/api/usuarios/${userId}/enrolar`, { method: "POST", body: formData })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) {
          setError(body.error);
          return;
        }
        setCapturas((count) => count + 1);
      });
  }, [hasCaptured, captureFrame, userId, capturas]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      <p>
        Fotos capturadas: {capturas} / 5
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `pnpm exec next dev --experimental-https`
Open `https://localhost:3000/marcacion` in Chrome, grant camera access, confirm `guide-state` text moves from `esperando` → `detectando` → `listo` as you center your face, and that a request to `/api/marcacion` fires in the Network tab once it reaches `listo`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/faceDetection.ts src/lib/client/useFaceGuide.ts src/app/marcacion src/app/admin
git commit -m "Add minimal kiosk and enrollment pages wired to the face-api.js hook"
```

---

### Task 12: Playwright smoke E2E (fake camera)

**Prerequisite:** a short fake video file for Chromium's fake camera device. If you don't have one, record a 5-10s webcam clip of a face and convert it:
```bash
ffmpeg -i mi-video.mp4 -vf format=yuv420p test/fixtures/fake-camera.y4m
```

**Files:**
- Modify: `package.json` (devDependency)
- Create: `playwright.config.ts`
- Create: `e2e/marcacion.spec.ts`

- [ ] **Step 1: Install Playwright**

Run:
```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Configure Playwright**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "https://localhost:3000",
    ignoreHTTPSErrors: true,
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${process.cwd()}/test/fixtures/fake-camera.y4m`,
      ],
    },
  },
  webServer: {
    command: "pnpm exec next dev --experimental-https",
    url: "https://localhost:3000",
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Write the smoke test**

Create `e2e/marcacion.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("la página de marcación carga la cámara y muestra el estado del óvalo", async ({ page }) => {
  await page.goto("/marcacion");

  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByTestId("guide-state")).toHaveText(/esperando|detectando|listo/);
});
```

This is a smoke test (page loads, camera permission works, the guide element renders and reaches a valid state) — not an assertion on recognition accuracy, per the spec's note that headless fake-camera testing of real face matching is unreliable.

- [ ] **Step 4: Run it**

Run: `pnpm exec playwright test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts e2e
git commit -m "Add Playwright smoke test for the kiosk camera flow"
```

---

## Final end-to-end verification (manual)

1. `docker compose up -d db` (if not already running) and confirm all previous `pnpm test` layers pass: `pnpm test`.
2. `pnpm exec next dev --experimental-https`.
3. Create a real user row (via Prisma Studio: `pnpm exec prisma studio`) and open `https://localhost:3000/admin/enrolar/<ese-userId>` to enroll your own face (5 captures).
4. Open `https://localhost:3000/marcacion`, look at the camera, confirm it responds `matched: true`, `tipo: "IN"` with your real name.
5. Reload and repeat — confirm the second marcación responds `tipo: "OUT"`.
6. Repeat steps 4-5 at both 1366×768 and 1920×1080 browser window sizes (accessibility requirement in `AGENTS.md`).
