-- La base "ganador" la crea la imagen (POSTGRES_USER). Aquí se agrega la de Traccar
-- y la extensión PostGIS (research R7).
CREATE DATABASE traccar;
\connect ganador
CREATE EXTENSION IF NOT EXISTS postgis;
