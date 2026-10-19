import { BrowserRouter } from "react-router";
import { LimiteError } from "./app/LimiteError";
import { Proveedores } from "./app/Proveedores";
import { Rutas } from "./app/Rutas";

export function App() {
  return (
    <LimiteError>
      <Proveedores>
        <BrowserRouter>
          <Rutas />
        </BrowserRouter>
      </Proveedores>
    </LimiteError>
  );
}
