-- =====================================================================
-- GymAccess - Script 01: Esquema del Sprint 1 (DDL)
-- Sistema de Gestión de Acceso y Control Financiero para Gimnasio
-- Motor: MySQL 8 / 9  ·  InnoDB  ·  utf8mb4
--
-- Qué hace:
--   1. Crea la base de datos gymaccess.
--   2. Crea las 5 tablas del Sprint 1 (usuarios, clientes,
--      tipos_membresia, membresias y pagos) con sus llaves primarias,
--      llaves foráneas y reglas (CHECK, UNIQUE, valores por defecto).
--   Las tablas rostros, accesos y auditoria están en el script 02
--   (Sprint 2).
--
-- Cómo ejecutarlo: como usuario root, en MySQL Workbench o en la
-- terminal de MySQL. Se puede volver a ejecutar: borra y recrea todo.
-- ¡CUIDADO! Volver a ejecutarlo elimina los datos que ya existan.
-- =====================================================================

DROP DATABASE IF EXISTS gymaccess;

CREATE DATABASE gymaccess
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE gymaccess;

-- ---------------------------------------------------------------------
-- 1. clientes
-- Personas inscritas en el gimnasio.
-- Reglas: nombre, apellido y teléfono obligatorios; correo opcional
-- pero único; baja lógica mediante estado (no se borran).
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id_cliente      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(80)     NOT NULL,
  apellido        VARCHAR(80)     NOT NULL,
  correo          VARCHAR(150)    NULL,
  telefono        VARCHAR(20)     NOT NULL,
  direccion       VARCHAR(255)    NULL,
  fecha_registro  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado          ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',

  CONSTRAINT pk_clientes PRIMARY KEY (id_cliente),
  CONSTRAINT uq_clientes_correo UNIQUE (correo),
  CONSTRAINT ck_clientes_nombre   CHECK (CHAR_LENGTH(TRIM(nombre))   > 0),
  CONSTRAINT ck_clientes_apellido CHECK (CHAR_LENGTH(TRIM(apellido)) > 0),
  CONSTRAINT ck_clientes_telefono CHECK (CHAR_LENGTH(TRIM(telefono)) > 0),
  INDEX idx_clientes_nombre (apellido, nombre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2. usuarios
-- Cuentas para entrar al sistema.
-- Reglas: correo único; password guarda el HASH de bcrypt (nunca texto
-- plano); 4 roles; si el rol es 'cliente' la cuenta debe estar
-- vinculada a un registro de clientes (y un cliente solo tiene una cuenta).
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id_usuario  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(120)  NOT NULL,
  correo      VARCHAR(150)  NOT NULL,
  password    VARCHAR(100)  NOT NULL COMMENT 'Hash bcrypt, nunca texto plano',
  rol         ENUM('administrador','recepcionista','entrenador','cliente') NOT NULL,
  estado      ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  id_cliente  INT UNSIGNED  NULL,
  fecha_registro DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuarios_correo  UNIQUE (correo),
  CONSTRAINT uq_usuarios_cliente UNIQUE (id_cliente),
  CONSTRAINT fk_usuarios_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente),
  -- rol cliente  => debe tener id_cliente
  -- otros roles  => no deben tener id_cliente
  CONSTRAINT ck_usuarios_rol_cliente CHECK (
    (rol = 'cliente'  AND id_cliente IS NOT NULL) OR
    (rol <> 'cliente' AND id_cliente IS NULL)
  )
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 3. tipos_membresia
-- Planes disponibles (mensual, trimestral, anual...).
-- Reglas: nombre único; duración en días mayor a 0; precio no negativo.
-- ---------------------------------------------------------------------
CREATE TABLE tipos_membresia (
  id_tipo_membresia INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre            VARCHAR(80)      NOT NULL,
  descripcion       VARCHAR(255)     NULL,
  duracion          INT UNSIGNED     NOT NULL COMMENT 'Duración en días',
  precio            DECIMAL(10,2)    NOT NULL,
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',

  CONSTRAINT pk_tipos_membresia PRIMARY KEY (id_tipo_membresia),
  CONSTRAINT uq_tipos_membresia_nombre UNIQUE (nombre),
  CONSTRAINT ck_tipos_membresia_duracion CHECK (duracion > 0),
  CONSTRAINT ck_tipos_membresia_precio   CHECK (precio >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. membresias
-- Relaciona un cliente con un tipo de membresía y su vigencia.
-- Reglas (RN-02, RN-03, RN-04): cliente y tipo válidos; fecha de inicio
-- y fin obligatorias; fin >= inicio; 4 estados posibles.
-- ---------------------------------------------------------------------
CREATE TABLE membresias (
  id_membresia      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente        INT UNSIGNED NOT NULL,
  id_tipo_membresia INT UNSIGNED NOT NULL,
  fecha_inicio      DATE         NOT NULL,
  fecha_fin         DATE         NOT NULL,
  estado            ENUM('activa','vencida','suspendida','cancelada') NOT NULL DEFAULT 'activa',

  CONSTRAINT pk_membresias PRIMARY KEY (id_membresia),
  CONSTRAINT fk_membresias_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_membresias_tipo FOREIGN KEY (id_tipo_membresia)
    REFERENCES tipos_membresia (id_tipo_membresia)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_membresias_fechas CHECK (fecha_fin >= fecha_inicio),
  INDEX idx_membresias_vigencia (id_cliente, estado, fecha_fin)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. pagos
-- Historial financiero.
-- Reglas (RN-05, RN-06): todo pago tiene cliente Y membresía; monto
-- mayor a 0; no se borran (se cancelan cambiando el estado).
-- ---------------------------------------------------------------------
CREATE TABLE pagos (
  id_pago      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_cliente   INT UNSIGNED  NOT NULL,
  id_membresia INT UNSIGNED  NOT NULL,
  monto        DECIMAL(10,2) NOT NULL,
  fecha_pago   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metodo_pago  ENUM('efectivo','tarjeta','transferencia') NOT NULL,
  estado       ENUM('registrado','cancelado') NOT NULL DEFAULT 'registrado',
  id_usuario   INT UNSIGNED  NULL COMMENT 'Usuario que registró el pago',

  CONSTRAINT pk_pagos PRIMARY KEY (id_pago),
  CONSTRAINT fk_pagos_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_pagos_membresia FOREIGN KEY (id_membresia)
    REFERENCES membresias (id_membresia)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_pagos_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_pagos_monto CHECK (monto > 0),
  INDEX idx_pagos_fecha (fecha_pago)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Verificación rápida: debe mostrar las 5 tablas
-- ---------------------------------------------------------------------
SHOW TABLES;
