-- Verificación de email obligatoria (gate en la app).
-- Grandfather: los usuarios que YA existían al activar el gate se marcan como verificados,
-- para no bloquearlos. De ahí en adelante, los nuevos quedan en email_verificado=false
-- (default de la columna) y deben verificar antes de usar la app.
-- One-time: correr una sola vez al activar el gate.

update profiles set email_verificado = true where email_verificado is not true;
