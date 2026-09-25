// Loaded before the PrismaClient import is *used* (not before it's linked — ESM
// import bindings are hoisted either way), so SEED_ADMIN_* and DATABASE_URL are
// in process.env by the time `new PrismaClient()` runs below.
process.loadEnvFile(".env");

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/server/passwords";

const prisma = new PrismaClient();

// El valor de ejemplo en .env.example — si alguien lo deja tal cual, el
// primer admin quedaría con una contraseña públicamente conocida.
const PLACEHOLDER_PASSWORD = "changeme";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nombre = process.env.SEED_ADMIN_NOMBRE;

  if (!email || !password || !nombre) {
    console.log(
      "SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD y SEED_ADMIN_NOMBRE son requeridos para crear el primer admin; omitiendo seed."
    );
    return;
  }

  if (password === PLACEHOLDER_PASSWORD) {
    console.log(
      `SEED_ADMIN_PASSWORD todavía tiene el valor de ejemplo ("${PLACEHOLDER_PASSWORD}"). ` +
        "Definí una contraseña real en tu archivo .env antes de crear el primer admin; omitiendo seed."
    );
    return;
  }

  const existente = await prisma.admin.findUnique({ where: { email } });
  if (existente) {
    console.log(`Ya existe un admin con el correo ${email}; omitiendo seed.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.admin.create({ data: { email, nombre, passwordHash } });
  console.log(`Admin inicial creado: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
