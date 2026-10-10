-- Los "Colegio Mayor" (del Rosario, de Antioquia, de Cundinamarca…) son
-- universidades: la migración anterior los marcó como colegio por el LIKE.
UPDATE [dbo].[User] SET [tipo] = 'universidad'
WHERE [tipo] = 'colegio' AND [universidad] LIKE N'%colegio mayor%';
