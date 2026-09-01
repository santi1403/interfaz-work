-- ============================================================
-- BD: gestion_clientes - Compatible con interfaz 2 (index.html/app.js)
-- Conexión: Host 127.0.0.1:3306 / User root (como en tu captura)
-- Ejecutar en MySQL Workbench: File -> Open SQL Script -> Ejecutar (rayo)
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_clientes
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_clientes;

-- Tabla principal: coincide 1:1 con los campos del formulario
-- EXCELENTES PRÁCTICAS: borrado lógico con estado (no DELETE físico)
CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  num_cliente VARCHAR(10) UNIQUE COMMENT '# Cliente - correlativo 0001',
  tipo_id ENUM('CC','CE','TI','PA','NIT','PEP','PPT','Otro') NOT NULL COMMENT 'Tipo ID (antes Tipo Cliente)',
  identificacion VARCHAR(20) NOT NULL COMMENT 'Validación dinámica 3-20 según Tipo ID',
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  direccion VARCHAR(255) NULL,
  telefono VARCHAR(20) NULL COMMENT '# Teléfono',
  pais VARCHAR(50) NULL,
  fecha_desde DATE NULL,
  fecha_nacimiento DATE NULL,
  estado ENUM('activo','suspendido') NOT NULL DEFAULT 'activo' COMMENT 'Borrado lógico - buenas prácticas',
  check_id VARCHAR(32) NULL COMMENT 'Factura/check externo - uso amigo API (ej HPL000019389)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_identificacion (identificacion),
  KEY idx_nombre_apellido (nombre, apellido),
  KEY idx_pais (pais),
  KEY idx_estado (estado),
  CONSTRAINT chk_identificacion_len CHECK (CHAR_LENGTH(identificacion) BETWEEN 3 AND 20)
) ENGINE=InnoDB;

-- Migración si ya existía la tabla sin estado (solo si ya tenías datos, ejecuta esta línea una vez):
-- Si te da error "Duplicate column 'estado'" ignóralo, ya está bien.
-- ALTER TABLE clientes ADD COLUMN estado ENUM('activo','suspendido') NOT NULL DEFAULT 'activo';
-- CREATE INDEX idx_estado ON clientes(estado);

-- Tabla hija: múltiples correos por cliente (botón + Agregar)
CREATE TABLE IF NOT EXISTS cliente_emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  UNIQUE KEY uk_cliente_email (cliente_id, email)
) ENGINE=InnoDB;

-- Datos demo (mismos que app.js para probar Buscar/Actualizar)
INSERT INTO clientes (num_cliente, tipo_id, identificacion, nombre, apellido, direccion, telefono, pais, fecha_desde, fecha_nacimiento) VALUES
('0001','CC','0102030405','María','González','Av. Amazonas 123','0991234567','Ecuador','2024-01-15','1990-05-20'),
('0002','CE','1723456789','Carlos','Ruiz','Calle 10 # 20-30','0987654321','Colombia','2023-11-02','1985-09-10'),
('0003','NIT','0933445566','Empresa','Soluciones SA','Parque Empresarial','022345678','Perú','2022-06-01','2000-01-01')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO cliente_emails (cliente_id, email) VALUES
(1,'maria.gonzalez@mail.com'),
(2,'carlos.ruiz@mail.com'),
(2,'c.ruiz@empresa.com'),
(3,'contacto@soluciones.pe')
ON DUPLICATE KEY UPDATE email=VALUES(email);

-- Vistas útiles
SELECT * FROM clientes;
SELECT c.num_cliente, c.tipo_id, c.identificacion, CONCAT(c.nombre,' ',c.apellido) AS cliente, GROUP_CONCAT(e.email SEPARATOR ', ') AS correos
FROM clientes c LEFT JOIN cliente_emails e ON e.cliente_id=c.id GROUP BY c.id;

-- Migración para BD ya existente (ejecuta una vez si tu tabla es VARCHAR(10)):
-- ALTER TABLE clientes MODIFY COLUMN identificacion VARCHAR(20);
-- ALTER TABLE clientes DROP CHECK chk_identificacion_10;
-- ALTER TABLE clientes ADD CONSTRAINT chk_identificacion_len CHECK (CHAR_LENGTH(identificacion) BETWEEN 3 AND 20);

-- Migración check_id (ejecuta una vez si ya tienes la BD creada):
-- ALTER TABLE clientes ADD COLUMN check_id VARCHAR(32) NULL COMMENT 'Factura/check externo' AFTER estado;
