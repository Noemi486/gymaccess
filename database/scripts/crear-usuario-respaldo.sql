-- =====================================================================
-- GymAccess - Usuario de MySQL para el respaldo diario (US13, FR-060)
--
-- Qué hace:
--   Crea el usuario gymaccess_respaldo@localhost (si no existe) y le da
--   permisos de SOLO LECTURA sobre la base gymaccess, los mínimos que
--   necesita mysqldump: SELECT, SHOW VIEW, TRIGGER y LOCK TABLES.
--
-- Qué NO hace:
--   - No crea, borra ni modifica tablas ni datos (no es una migración).
--   - No da INSERT, UPDATE, DELETE, DROP ni permisos sobre otras bases.
--   - No toca a gymaccess_app ni a gymaccess_test.
--
-- Antes de ejecutarlo:
--   Cambia CAMBIA_ESTA_CONTRASENA por una contraseña nueva y segura (la
--   misma que pondrás en RESPALDO_DB_PASSWORD de backend/.env). No guardes
--   este archivo con la contraseña real ni lo subas a Git con ella.
--
-- Cómo ejecutarlo (una sola vez), como root, en MySQL Workbench o en la terminal:
--     mysql -u root -p -e "source database/scripts/crear-usuario-respaldo.sql"
--
-- Para cambiar la contraseña después:
--     ALTER USER 'gymaccess_respaldo'@'localhost' IDENTIFIED BY 'nueva';
-- =====================================================================

CREATE USER IF NOT EXISTS 'gymaccess_respaldo'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASENA';

GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON gymaccess.* TO 'gymaccess_respaldo'@'localhost';

FLUSH PRIVILEGES;

-- Comprobación: debe mostrar solo los permisos de arriba sobre gymaccess.
SHOW GRANTS FOR 'gymaccess_respaldo'@'localhost';
