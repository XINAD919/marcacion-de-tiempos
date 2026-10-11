BEGIN TRY

BEGIN TRAN;

-- Universidad / colegio ya no es un tipo de usuario: lo dice su institución
-- (maqueta 4f). El texto libre de universidad y entidad ya está en el
-- catálogo desde la migración instituciones_y_sedes.
UPDATE [dbo].[User] SET [tipo] = 'practicante' WHERE [tipo] <> 'natural';

-- AlterTable
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_tipo_df];
ALTER TABLE [dbo].[User] DROP COLUMN [entidad],
[universidad];
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_tipo_df] DEFAULT 'practicante' FOR [tipo];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

