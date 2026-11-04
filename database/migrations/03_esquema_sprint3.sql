-- =====================================================================
-- GymAccess - Script 03: Esquema del Sprint 3 (DDL)
-- Motor: MySQL 8 / 9  ·  InnoDB  ·  utf8mb4
--
-- Qué hace: agrega las 6 tablas del Sprint 3 (entrenadores, asignaciones,
-- rutinas, ejercicios, objetivos y progresos). Spec: specs/004-entrenadores-rutinas.
--
-- Qué NO hace:
--   - No borra ni modifica ninguna tabla ni dato existente (sin DROP,
--     sin ALTER, sin DELETE). Usa CREATE TABLE IF NOT EXISTS: se puede
--     ejecutar de nuevo sin perder nada.
--   - No crea `estadisticas_dashboard`: las cifras se calculan en el
--     momento (spec 004, FR-023).
--   - No cambia permisos: gymaccess_app ya tiene permisos sobre toda la base.
--
-- Cómo ejecutarlo (como root), UNA VEZ EN CADA BASE, abriendo mysql desde
-- la carpeta raíz del proyecto (gym-system):
--   mysql -u root -p
--   mysql> USE gymaccess;
--   mysql> SOURCE database/migrations/03_esquema_sprint3.sql
--   mysql> USE gymaccess_test;
--   mysql> SOURCE database/migrations/03_esquema_sprint3.sql
--
-- Requisito: scripts 01 y 02 ya ejecutados en esa base.
-- Las bajas son lógicas: ningún registro de estas tablas se elimina.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 9. entrenadores
-- Ficha de una cuenta con rol entrenador (teléfono y especialidad).
-- Su estado es el de la cuenta (usuarios.estado). Las asignaciones,
-- rutinas, objetivos y avances apuntan a usuarios.id_usuario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entrenadores (
  id_entrenador  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED NOT NULL,
  telefono       VARCHAR(20)  NULL,
  especialidad   VARCHAR(100) NULL,
  fecha_registro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_entrenadores PRIMARY KEY (id_entrenador),
  CONSTRAINT uq_entrenadores_usuario UNIQUE (id_usuario),
  CONSTRAINT fk_entrenadores_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 10. asignaciones_entrenador
-- Cliente <-> entrenador. A lo más UNA activa por cliente: lo garantiza
-- el índice único sobre la columna generada `cliente_activa` (vale el
-- id_cliente solo cuando la asignación está activa; NULL no se repite).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones_entrenador (
  id_asignacion   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente      INT UNSIGNED NOT NULL,
  id_entrenador   INT UNSIGNED NOT NULL COMMENT 'usuarios.id_usuario con rol entrenador',
  fecha_inicio    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin       DATETIME     NULL,
  estado          ENUM('activa','finalizada') NOT NULL DEFAULT 'activa',
  id_usuario      INT UNSIGNED NULL COMMENT 'Quién hizo la asignación',
  cliente_activa  INT UNSIGNED AS (IF(estado = 'activa', id_cliente, NULL)) STORED,

  CONSTRAINT pk_asignaciones PRIMARY KEY (id_asignacion),
  CONSTRAINT uq_asignaciones_activa UNIQUE (cliente_activa),
  CONSTRAINT fk_asignaciones_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT fk_asignaciones_entrenador FOREIGN KEY (id_entrenador) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_asignaciones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_asignaciones_fin CHECK (estado = 'activa' OR fecha_fin IS NOT NULL),
  INDEX idx_asignaciones_entrenador (id_entrenador, estado),
  INDEX idx_asignaciones_cliente (id_cliente)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 11. rutinas
-- A lo más UNA activa por cliente (misma técnica). Modificar una rutina
-- crea una versión nueva y archiva la anterior (id_rutina_anterior).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutinas (
  id_rutina          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente         INT UNSIGNED NOT NULL,
  id_entrenador      INT UNSIGNED NOT NULL COMMENT 'usuarios.id_usuario',
  nombre             VARCHAR(100) NOT NULL,
  indicaciones       VARCHAR(500) NULL,
  estado             ENUM('activa','archivada') NOT NULL DEFAULT 'activa',
  fecha_creacion     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_archivo      DATETIME     NULL,
  id_rutina_anterior INT UNSIGNED NULL,
  cliente_activa     INT UNSIGNED AS (IF(estado = 'activa', id_cliente, NULL)) STORED,

  CONSTRAINT pk_rutinas PRIMARY KEY (id_rutina),
  CONSTRAINT uq_rutinas_activa UNIQUE (cliente_activa),
  CONSTRAINT fk_rutinas_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT fk_rutinas_entrenador FOREIGN KEY (id_entrenador) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_rutinas_anterior FOREIGN KEY (id_rutina_anterior) REFERENCES rutinas (id_rutina),
  CONSTRAINT ck_rutinas_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
  CONSTRAINT ck_rutinas_archivo CHECK (estado = 'activa' OR fecha_archivo IS NOT NULL),
  INDEX idx_rutinas_cliente (id_cliente, fecha_creacion)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 12. ejercicios_rutina
-- Ejercicios de una rutina por día (1 a 7). Cada uno necesita series,
-- repeticiones o instrucciones. No se editan: una versión nueva de la
-- rutina trae sus propios ejercicios.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ejercicios_rutina (
  id_ejercicio  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_rutina     INT UNSIGNED      NOT NULL,
  dia           TINYINT UNSIGNED  NOT NULL,
  orden         TINYINT UNSIGNED  NOT NULL,
  nombre        VARCHAR(100)      NOT NULL,
  series        TINYINT UNSIGNED  NULL,
  repeticiones  VARCHAR(30)       NULL,
  peso_kg       DECIMAL(5,2)      NULL,
  descanso_seg  SMALLINT UNSIGNED NULL,
  instrucciones VARCHAR(300)      NULL,

  CONSTRAINT pk_ejercicios PRIMARY KEY (id_ejercicio),
  CONSTRAINT uq_ejercicios_orden UNIQUE (id_rutina, dia, orden),
  CONSTRAINT fk_ejercicios_rutina FOREIGN KEY (id_rutina) REFERENCES rutinas (id_rutina),
  CONSTRAINT ck_ejercicios_dia CHECK (dia BETWEEN 1 AND 7),
  CONSTRAINT ck_ejercicios_orden CHECK (orden BETWEEN 1 AND 20),
  CONSTRAINT ck_ejercicios_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
  CONSTRAINT ck_ejercicios_series CHECK (series IS NULL OR series BETWEEN 1 AND 20),
  CONSTRAINT ck_ejercicios_peso CHECK (peso_kg IS NULL OR peso_kg BETWEEN 0 AND 500),
  CONSTRAINT ck_ejercicios_descanso CHECK (descanso_seg IS NULL OR descanso_seg <= 600),
  CONSTRAINT ck_ejercicios_detalle CHECK (series IS NOT NULL OR repeticiones IS NOT NULL OR instrucciones IS NOT NULL)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 13. objetivos_entrenamiento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS objetivos_entrenamiento (
  id_objetivo    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente     INT UNSIGNED NOT NULL,
  id_entrenador  INT UNSIGNED NOT NULL COMMENT 'usuarios.id_usuario',
  descripcion    VARCHAR(200) NOT NULL,
  meta           VARCHAR(100) NULL,
  fecha_limite   DATE         NULL,
  estado         ENUM('en_curso','cumplido','cancelado') NOT NULL DEFAULT 'en_curso',
  fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre   DATETIME     NULL,

  CONSTRAINT pk_objetivos PRIMARY KEY (id_objetivo),
  CONSTRAINT fk_objetivos_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT fk_objetivos_entrenador FOREIGN KEY (id_entrenador) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_objetivos_descripcion CHECK (CHAR_LENGTH(TRIM(descripcion)) > 0),
  CONSTRAINT ck_objetivos_cierre CHECK (estado = 'en_curso' OR fecha_cierre IS NOT NULL),
  INDEX idx_objetivos_cliente (id_cliente, estado)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 14. progresos_clientes
-- Avances con medidas deportivas (no médicas). Al menos un dato.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progresos_clientes (
  id_progreso         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente          INT UNSIGNED NOT NULL,
  id_entrenador       INT UNSIGNED NOT NULL COMMENT 'usuarios.id_usuario',
  fecha               DATE         NOT NULL,
  peso_kg             DECIMAL(5,2) NULL,
  grasa_pct           DECIMAL(4,1) NULL,
  cintura_cm          DECIMAL(5,1) NULL,
  comentario          VARCHAR(500) NULL,
  fecha_registro      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME     NULL,

  CONSTRAINT pk_progresos PRIMARY KEY (id_progreso),
  CONSTRAINT fk_progresos_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT fk_progresos_entrenador FOREIGN KEY (id_entrenador) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_progresos_peso CHECK (peso_kg IS NULL OR peso_kg BETWEEN 20 AND 400),
  CONSTRAINT ck_progresos_grasa CHECK (grasa_pct IS NULL OR grasa_pct BETWEEN 2 AND 70),
  CONSTRAINT ck_progresos_cintura CHECK (cintura_cm IS NULL OR cintura_cm BETWEEN 30 AND 250),
  CONSTRAINT ck_progresos_dato CHECK (
    peso_kg IS NOT NULL OR grasa_pct IS NOT NULL OR cintura_cm IS NOT NULL OR
    (comentario IS NOT NULL AND CHAR_LENGTH(TRIM(comentario)) > 0)
  ),
  INDEX idx_progresos_cliente (id_cliente, fecha),
  INDEX idx_progresos_entrenador (id_entrenador, fecha_registro)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Verificación: ahora debe mostrar 14 tablas
-- ---------------------------------------------------------------------
SHOW TABLES;
