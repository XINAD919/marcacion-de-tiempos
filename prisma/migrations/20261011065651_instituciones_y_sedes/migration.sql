BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[User] ADD [institucionId] INT,
[sedeId] INT;

-- CreateTable
CREATE TABLE [dbo].[Institucion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(150) NOT NULL,
    [tipo] VARCHAR(20) NOT NULL,
    [horasExigidas] INT NOT NULL CONSTRAINT [Institucion_horasExigidas_df] DEFAULT 0,
    [activa] BIT NOT NULL CONSTRAINT [Institucion_activa_df] DEFAULT 1,
    CONSTRAINT [Institucion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Institucion_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Sede] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(150) NOT NULL,
    [direccion] NVARCHAR(200),
    [horaApertura] VARCHAR(5),
    [horaCierre] VARCHAR(5),
    [activa] BIT NOT NULL CONSTRAINT [Sede_activa_df] DEFAULT 1,
    CONSTRAINT [Sede_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Sede_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_institucionId_idx] ON [dbo].[User]([institucionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_sedeId_idx] ON [dbo].[User]([sedeId]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_institucionId_fkey] FOREIGN KEY ([institucionId]) REFERENCES [dbo].[Institucion]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_sedeId_fkey] FOREIGN KEY ([sedeId]) REFERENCES [dbo].[Sede]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- Catálogo a partir del texto libre que ya existe (maqueta 4f): nadie vuelve a
-- digitar nada. La intercalación por defecto no distingue mayúsculas, así que
-- "Universidad Nacional" y "universidad nacional " quedan como una sola.
-- Tipo y horas exigidas: el valor más frecuente entre sus usuarios.
-- EXEC porque SQL Server compila el lote antes de que existan las columnas nuevas.
EXEC('
INSERT INTO [dbo].[Institucion] ([nombre], [tipo], [horasExigidas], [activa])
SELECT n.[nombre],
       ISNULL((SELECT TOP 1 u.[tipo] FROM [dbo].[User] u
               WHERE LEFT(LTRIM(RTRIM(u.[universidad])), 150) = n.[nombre]
                 AND u.[tipo] IN (''universidad'', ''colegio'')
               GROUP BY u.[tipo]
               ORDER BY COUNT(*) DESC, u.[tipo] DESC), ''universidad''),
       ISNULL((SELECT TOP 1 u.[horasRequeridas] FROM [dbo].[User] u
               WHERE LEFT(LTRIM(RTRIM(u.[universidad])), 150) = n.[nombre]
                 AND u.[horasRequeridas] > 0
               GROUP BY u.[horasRequeridas]
               ORDER BY COUNT(*) DESC, u.[horasRequeridas] DESC), 0),
       1
FROM (SELECT DISTINCT LEFT(LTRIM(RTRIM([universidad])), 150) AS [nombre]
      FROM [dbo].[User]
      WHERE [tipo] <> ''natural'' AND LTRIM(RTRIM(ISNULL([universidad], N''''))) <> N'''') AS n;

INSERT INTO [dbo].[Sede] ([nombre], [activa])
SELECT DISTINCT LEFT(LTRIM(RTRIM([entidad])), 150), 1
FROM [dbo].[User]
WHERE [tipo] <> ''natural'' AND LTRIM(RTRIM(ISNULL([entidad], N''''))) <> N'''';

UPDATE u SET u.[institucionId] = i.[id]
FROM [dbo].[User] u
JOIN [dbo].[Institucion] i ON i.[nombre] = LEFT(LTRIM(RTRIM(u.[universidad])), 150)
WHERE u.[tipo] <> ''natural'';

UPDATE u SET u.[sedeId] = s.[id]
FROM [dbo].[User] u
JOIN [dbo].[Sede] s ON s.[nombre] = LEFT(LTRIM(RTRIM(u.[entidad])), 150)
WHERE u.[tipo] <> ''natural'';
');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
