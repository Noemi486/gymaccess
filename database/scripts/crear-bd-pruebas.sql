-- =====================================================================
-- GymAccess - Base de datos de PRUEBAS (gymaccess_test)
--
-- Qué hace:
--   1. Crea la base gymaccess_test (si no existe) con el mismo juego de
--      caracteres y la misma intercalación que gymaccess.
--   2. Crea en ella las 8 tablas del esquema oficial (las mismas de
--      migrations/01_esquema_sprint1.sql y 02_esquema_sprint2.sql).
--   3. Da al usuario gymaccess_app los permisos SELECT, INSERT, UPDATE y
--      DELETE SOLO sobre gymaccess_test.
--
-- Qué NO hace:
--   - No toca la base gymaccess: no la crea, no la borra, no la modifica y
--     no cambia los permisos que gymaccess_app tiene sobre ella.
--   - No borra nada: usa CREATE ... IF NOT EXISTS, así que se puede volver a
--     ejecutar sin perder datos.
--   - No ejecuta migrations/01_esquema_sprint1.sql (ese script empieza con
--     DROP DATABASE gymaccess).
--
-- Cómo ejecutarlo: como usuario root, en MySQL Workbench o en la terminal:
--     mysql -u root -p -e "source database/scripts/crear-bd-pruebas.sql"
-- (desde la raíz del proyecto), o abrirlo en MySQL Workbench y ejecutarlo completo.
--
-- Para dejar la base de pruebas vacía de nuevo (solo gymaccess_test):
--     DROP DATABASE gymaccess_test;
-- y volver a ejecutar este script.
--
-- Mantenimiento: si cambia el esquema oficial (nuevo script en migrations/),
-- hay que reflejar el cambio aquí para que las pruebas usen la misma estructura.
--
-- Cuenta de la aplicación: gymaccess_app@localhost. Si tu usuario está definido
-- con otro host, cambia 'localhost' en el GRANT del final
-- (consúltalo con: SELECT user, host FROM mysql.user WHERE user = 'gymaccess_app';).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS gymaccess_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE gymaccess_test;

-- ---------------------------------------------------------------------
-- 1. clientes
-- Personas inscritas en el gimnasio.
-- Reglas: nombre, apellido y teléfono obligatorios; correo opcional
-- pero único; baja lógica mediante estado (no se borran).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
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
CREATE TABLE IF NOT EXISTS usuarios (
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
CREATE TABLE IF NOT EXISTS tipos_membresia (
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
CREATE TABLE IF NOT EXISTS membresias (
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
CREATE TABLE IF NOT EXISTS pagos (
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
-- 6. rostros
-- Datos para identificar facialmente a un cliente.
-- Reglas (RN-01, RN-12): el cliente debe existir; el descriptor se
-- guarda CIFRADO por el backend; solo se usa para control de acceso.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rostros (
  id_rostro         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente        INT UNSIGNED NOT NULL,
  descriptor_facial BLOB         NOT NULL COMMENT 'Descriptor facial cifrado por el backend',
  fecha_registro    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',

  CONSTRAINT pk_rostros PRIMARY KEY (id_rostro),
  CONSTRAINT fk_rostros_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_rostros_cliente (id_cliente, estado)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 7. accesos
-- Cada intento de entrada al gimnasio (autorizado o rechazado).
-- Reglas (RN-10, RN-11): todo intento se registra; si fue rechazado
-- debe tener motivo; id_cliente puede ser NULL si el rostro no se
-- reconoció; no se borran.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accesos (
  id_acceso      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente     INT UNSIGNED NULL COMMENT 'NULL si el rostro no fue reconocido',
  fecha          DATE         NOT NULL DEFAULT (CURRENT_DATE),
  hora           TIME         NOT NULL DEFAULT (CURRENT_TIME),
  tipo           ENUM('entrada','salida') NOT NULL DEFAULT 'entrada',
  resultado      ENUM('autorizado','rechazado') NOT NULL,
  motivo_rechazo VARCHAR(255) NULL,

  CONSTRAINT pk_accesos PRIMARY KEY (id_acceso),
  CONSTRAINT fk_accesos_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente),
  -- rechazado => debe tener motivo
  CONSTRAINT ck_accesos_motivo CHECK (
    resultado = 'autorizado' OR
    (motivo_rechazo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo_rechazo)) > 0)
  ),
  -- autorizado => debe ser un cliente identificado
  CONSTRAINT ck_accesos_autorizado CHECK (
    resultado = 'rechazado' OR id_cliente IS NOT NULL
  ),
  INDEX idx_accesos_fecha (fecha, hora),
  INDEX idx_accesos_cliente (id_cliente)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 8. auditoria
-- Acciones importantes hechas dentro del sistema (solo las consulta
-- el administrador). No se borran.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario   INT UNSIGNED NULL COMMENT 'NULL si la acción la hizo el sistema',
  accion       VARCHAR(100) NOT NULL,
  modulo       VARCHAR(50)  NOT NULL,
  fecha        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resultado    ENUM('exito','error') NOT NULL,
  descripcion  VARCHAR(500) NULL,

  CONSTRAINT pk_auditoria PRIMARY KEY (id_auditoria),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_auditoria_fecha (fecha),
  INDEX idx_auditoria_modulo (modulo)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Permisos de gymaccess_app SOLO sobre la base de pruebas.
-- En gymaccess sigue teniendo únicamente SELECT, INSERT y UPDATE.
-- (DELETE aquí permite que las pruebas limpien sus propios datos.)
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON gymaccess_test.* TO 'gymaccess_app'@'localhost';

-- ---------------------------------------------------------------------
-- Verificación rápida: debe mostrar las 8 tablas y los permisos concedidos
-- ---------------------------------------------------------------------
SHOW TABLES;
SHOW GRANTS FOR 'gymaccess_app'@'localhost';
