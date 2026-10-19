-- Esquema de SIC-InvLaFe para PostgreSQL propio (sin Supabase).
-- Generado a partir del esquema exportado de Supabase.
-- Cambios: se quitaron las políticas RLS, las funciones que dependían de
-- auth.uid() y la relación con auth.users; se agregó usuarios.contrasena_hash.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: permisos_rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permisos_rol (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rol_id uuid NOT NULL,
    modulo_id uuid NOT NULL,
    puede_ver boolean DEFAULT false NOT NULL,
    puede_crear boolean DEFAULT false NOT NULL,
    puede_editar boolean DEFAULT false NOT NULL,
    puede_eliminar boolean DEFAULT false NOT NULL
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    telefono text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compras (
    id bigint NOT NULL,
    proveedor_id uuid NOT NULL,
    fecha date NOT NULL,
    numero_factura text,
    valor_factura numeric(14,2) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compras_valor_factura_check CHECK ((valor_factura >= (0)::numeric))
);


--
-- Name: compras_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.compras ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.compras_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cotizacion_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cotizacion_items (
    id bigint NOT NULL,
    cotizacion_id uuid NOT NULL,
    producto_id uuid NOT NULL,
    cantidad numeric(14,2) NOT NULL,
    precio_unitario numeric(14,2) NOT NULL,
    venta_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cotizacion_items_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT cotizacion_items_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric))
);


--
-- Name: cotizacion_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cotizacion_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cotizacion_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cotizaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cotizaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    fecha date NOT NULL,
    detalle text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    venta_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cotizaciones_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'rechazada'::text])))
);


--
-- Name: lotes_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lotes_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    producto_id uuid NOT NULL,
    cantidad_comprada numeric NOT NULL,
    precio_unitario numeric NOT NULL,
    cantidad_disponible numeric NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    compra_id bigint NOT NULL
);


--
-- Name: modulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL
);


--
-- Name: pagos_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_cliente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venta_id uuid NOT NULL,
    fecha date NOT NULL,
    monto numeric NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pagos_proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_proveedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fecha date NOT NULL,
    monto numeric NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    compra_id bigint NOT NULL
);


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    telefono text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    correo text NOT NULL,
    telefono text,
    rol_id uuid,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    usuario text,
    debe_cambiar_contrasena boolean DEFAULT false NOT NULL,
    contrasena_hash text,
    CONSTRAINT usuarios_usuario_formato CHECK (((usuario IS NULL) OR (usuario ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$'::text)))
);


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lote_compra_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    fecha date NOT NULL,
    numero_factura text,
    cantidad numeric NOT NULL,
    precio_unitario numeric NOT NULL,
    valor_total numeric NOT NULL,
    saldo_pendiente numeric NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    detalle text
);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: cotizacion_items cotizacion_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_pkey PRIMARY KEY (id);


--
-- Name: cotizaciones cotizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_pkey PRIMARY KEY (id);


--
-- Name: lotes_compra lotes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes_compra
    ADD CONSTRAINT lotes_compra_pkey PRIMARY KEY (id);


--
-- Name: modulos modulos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_nombre_key UNIQUE (nombre);


--
-- Name: modulos modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_pkey PRIMARY KEY (id);


--
-- Name: pagos_cliente pagos_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cliente
    ADD CONSTRAINT pagos_cliente_pkey PRIMARY KEY (id);


--
-- Name: pagos_proveedor pagos_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_rol_id_modulo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_rol_id_modulo_id_key UNIQUE (rol_id, modulo_id);


--
-- Name: productos productos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_nombre_key UNIQUE (nombre);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: compras_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compras_fecha_idx ON public.compras USING btree (fecha DESC);


--
-- Name: compras_proveedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compras_proveedor_idx ON public.compras USING btree (proveedor_id);


--
-- Name: cotizacion_items_cotizacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cotizacion_items_cotizacion_idx ON public.cotizacion_items USING btree (cotizacion_id);


--
-- Name: lotes_compra_compra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lotes_compra_compra_idx ON public.lotes_compra USING btree (compra_id);


--
-- Name: pagos_proveedor_compra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_proveedor_compra_idx ON public.pagos_proveedor USING btree (compra_id);


--
-- Name: usuarios_usuario_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX usuarios_usuario_unico ON public.usuarios USING btree (lower(usuario)) WHERE (usuario IS NOT NULL);


--
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: cotizacion_items cotizacion_items_cotizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id) ON DELETE CASCADE;


--
-- Name: cotizacion_items cotizacion_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: cotizacion_items cotizacion_items_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- Name: cotizaciones cotizaciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: cotizaciones cotizaciones_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: lotes_compra lotes_compra_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes_compra
    ADD CONSTRAINT lotes_compra_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- Name: lotes_compra lotes_compra_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes_compra
    ADD CONSTRAINT lotes_compra_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: pagos_cliente pagos_cliente_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_cliente
    ADD CONSTRAINT pagos_cliente_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: pagos_proveedor pagos_proveedor_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- Name: permisos_rol permisos_rol_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id) ON DELETE CASCADE;


--
-- Name: permisos_rol permisos_rol_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id);


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: ventas ventas_lote_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_lote_compra_id_fkey FOREIGN KEY (lote_compra_id) REFERENCES public.lotes_compra(id);
