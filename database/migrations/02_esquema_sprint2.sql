-- =====================================================================
-- GymAccess - Script 02: Esquema del Sprint 2 (DDL)
-- Motor: MySQL 8 / 9  ·  InnoDB  ·  utf8mb4
--
-- Qué hace: agrega a la base gymaccess las 3 tablas del Sprint 2
-- (rostros, accesos y auditoria). No borra nada de lo que ya existe.
--
-- Requisito: haber ejecutado antes el script 01.
-- Nota: la forma definitiva de guardar el descriptor facial se decide
-- en la planificación del Sprint 2; si cambia, se agrega un script nuevo.
-- =====================================================================

USE gymaccess;

-- ---------------------------------------------------------------------
-- 6. rostros
-- Datos para identificar facialmente a un cliente.
-- Reglas (RN-01, RN-12): el cliente debe existir; el descriptor se
-- guarda CIFRADO por el backend; solo se usa para control de acceso.
-- ---------------------------------------------------------------------
CREATE TABLE rostros (
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
CREATE TABLE accesos (
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
CREATE TABLE auditoria (
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
-- Verificación rápida: ahora debe mostrar las 8 tablas
-- ---------------------------------------------------------------------
SHOW TABLES;
