-- Inicialização do Cluster PostgreSQL do FALCON GROWTH
-- 1. Habilita extensões essenciais no banco central (FALCON CORE)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Cria role dedicada para o Provisionador Automático de Bancos Individuais por Tenant
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'falcon_provisioner') THEN
    CREATE ROLE falcon_provisioner WITH LOGIN CREATEDB CREATEROLE PASSWORD 'falcon_provisioner_local_dev_password';
  END IF;
END
$$;
