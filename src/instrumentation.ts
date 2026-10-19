// Arranca el trabajador del envío masivo de carnets una vez por proceso.
// Solo en el runtime de Node (necesita Prisma y SMTP) y no durante las pruebas.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { iniciarTrabajador } = await import("./lib/server/envioCarnetsWorker");
    iniciarTrabajador();
  }
}
