import logoUrl from "../../assets/logo-inversioneslafe.png";

export interface LogoCargado {
  dataUrl: string;
  ancho: number;
  alto: number;
}

let logoPromise: Promise<LogoCargado | null> | null = null;

/**
 * Carga el logo una sola vez para toda la sesión y lo deja listo como
 * `dataURL` (jsPDF no puede pedir una URL de red directamente). Si falla
 * —sin conexión, archivo movido— cualquier documento se arma sin logo en vez
 * de reventar.
 *
 * Compartido entre los reportes y la cotización en PDF: es el mismo logo y no
 * tiene sentido pedirlo dos veces.
 */
export function cargarLogo(): Promise<LogoCargado | null> {
  logoPromise ??= fetch(logoUrl)
    .then(async (respuesta) => {
      const blob = await respuesta.blob();
      const [dataUrl, bitmap] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          const lector = new FileReader();
          lector.onload = () => resolve(lector.result as string);
          lector.onerror = () => reject(lector.error);
          lector.readAsDataURL(blob);
        }),
        createImageBitmap(blob),
      ]);
      return { dataUrl, ancho: bitmap.width, alto: bitmap.height };
    })
    .catch(() => null);

  return logoPromise;
}
