BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Configuracion] ADD [minMinutosAntesSalidaNatural] INT NOT NULL CONSTRAINT [Configuracion_minMinutosAntesSalidaNatural_df] DEFAULT 60,
[toleranciaLlegadaNaturalMin] INT NOT NULL CONSTRAINT [Configuracion_toleranciaLlegadaNaturalMin_df] DEFAULT 10;

-- AlterTable
ALTER TABLE [dbo].[User] ALTER COLUMN [universidad] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[User] ALTER COLUMN [entidad] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[User] ADD [tipo] VARCHAR(20) NOT NULL CONSTRAINT [User_tipo_df] DEFAULT 'universidad';

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tipo_idx] ON [dbo].[User]([tipo]);

-- Usuarios existentes: todos quedan como universidad (default de la columna),
-- salvo los que ya decían colegio o institución educativa. La coordinadora
-- corrige a mano lo que esto no cubra. EXEC porque SQL Server compila el lote
-- antes de que exista la columna [tipo].
EXEC('UPDATE [dbo].[User] SET [tipo] = ''colegio''
      WHERE [universidad] LIKE N''%colegio%''
         OR [universidad] LIKE N''%institución educativa%''
         OR [universidad] LIKE N''%institucion educativa%''');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
