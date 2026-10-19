import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { cerrarPool, consultarUno, transaccion } from "../infraestructura/db/pool.js";
import { cifrarContrasena } from "../modulos/acceso/autenticacion.js";

/**
 * Crea el primer administrador, o le pone una contraseña nueva si ya existe.
 *
 * Como no hay recuperación por correo, esta es la salida cuando el único
 * administrador olvida su contraseña. Se ejecuta en el servidor, nunca desde
 * la web:
 *
 *   docker compose exec backend node dist/herramientas/crear-admin.js \
 *     --correo admin@ejemplo.com --nombre "Nombre Apellido" --usuario admin
 *
 * Imprime una contraseña temporal y marca la cuenta para que pida cambiarla
 * en el primer acceso. El rol «Administrador» recibe todos los permisos sobre
 * todos los módulos; si no existe, se crea.
 */

const AYUDA = `Uso:
  node dist/herramientas/crear-admin.js --correo <correo> [--nombre <nombre>] [--usuario <usuario>]

  --correo   Obligatorio. Si ya existe, solo se restablece su contraseña.
  --nombre   Nombre para mostrar (por defecto, "Administrador").
  --usuario  Nombre de usuario para entrar sin escribir el correo (opcional).`;

function contrasenaTemporal(): string {
  // 12 caracteres legibles: sin 0/O ni 1/l/I, que se confunden al dictarla.
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => alfabeto[b % alfabeto.length]).join("");
}

async function principal() {
  const { values } = parseArgs({
    options: {
      correo: { type: "string" },
      nombre: { type: "string" },
      usuario: { type: "string" },
      ayuda: { type: "boolean", short: "h" },
    },
  });

  const correo = values.correo?.trim().toLowerCase();
  if (values.ayuda || !correo) {
    console.log(AYUDA);
    process.exitCode = values.ayuda ? 0 : 1;
    return;
  }

  const contrasena = contrasenaTemporal();
  const hash = await cifrarContrasena(contrasena);

  const resultado = await transaccion(async (cx) => {
    const rol = await consultarUno<{ id: string }>(
      `insert into roles (nombre) values ('Administrador')
       on conflict (nombre) do update set nombre = excluded.nombre
       returning id`,
      [],
      "preparar el rol Administrador",
      cx,
    );

    await consultarUno(
      `insert into permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
       select $1, m.id, true, true, true, true from modulos m
       on conflict (rol_id, modulo_id) do update
         set puede_ver = true, puede_crear = true, puede_editar = true, puede_eliminar = true
       returning id`,
      [rol!.id],
      "dar permisos al rol Administrador",
      cx,
    );

    const existente = await consultarUno<{ id: string }>(
      "select id from usuarios where lower(correo) = $1",
      [correo],
      "buscar el usuario",
      cx,
    );

    if (existente) {
      await consultarUno(
        `update usuarios
            set contrasena_hash = $2, debe_cambiar_contrasena = true, activo = true, rol_id = $3
          where id = $1 returning id`,
        [existente.id, hash, rol!.id],
        "restablecer la contraseña",
        cx,
      );
      return "restablecido";
    }

    await consultarUno(
      `insert into usuarios
         (nombre, correo, usuario, rol_id, activo, debe_cambiar_contrasena, contrasena_hash)
       values ($1, $2, $3, $4, true, true, $5)
       returning id`,
      [values.nombre?.trim() || "Administrador", correo, values.usuario?.trim() || null, rol!.id, hash],
      "crear el usuario",
      cx,
    );
    return "creado";
  }, "crear el administrador");

  console.log(
    `\nAdministrador ${resultado}: ${correo}\n` +
      `Contraseña temporal: ${contrasena}\n\n` +
      "Al entrar, el sistema pedirá cambiarla.\n",
  );
}

principal()
  .catch((error: unknown) => {
    console.error("No se pudo crear el administrador:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void cerrarPool());
