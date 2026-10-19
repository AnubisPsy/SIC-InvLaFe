import type { Cliente, FechaHoraISO, ID, Proveedor } from "@invlafe/core";

/**
 * Lo que clientes y proveedores tienen en común, que hoy resulta ser todo.
 *
 * Se declara la forma en vez de usar `Cliente | Proveedor` para dejar explícito
 * qué campos usan las pantallas compartidas, y porque una unión obligaría a
 * estrechar el tipo en cada acceso sin ganar nada.
 */
export interface Contacto {
  id: ID;
  nombre: string;
  telefono: string | null;
  creadoEn: FechaHoraISO;
}

/**
 * Comprobación en tiempo de compilación de que las dos entidades siguen
 * encajando aquí.
 *
 * Si algún día una de las dos crece —un RTN para el cliente, un plazo de pago
 * para el proveedor—, esto sigue compilando (los campos de más no estorban),
 * pero si a alguna le faltara un campo, o cambiara de tipo, el error salta en
 * este archivo y no desperdigado por las pantallas.
 */
const _encajan: [Contacto, Contacto] = [
  null as unknown as Cliente,
  null as unknown as Proveedor,
];
void _encajan;
