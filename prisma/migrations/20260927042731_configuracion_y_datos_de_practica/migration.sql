BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[User] ALTER COLUMN [email] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[User] ADD [fechaInicio] DATE,
[horaFin] VARCHAR(5),
[horaInicio] VARCHAR(5),
[horasRequeridas] INT NOT NULL CONSTRAINT [User_horasRequeridas_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[Configuracion] (
    [id] INT NOT NULL CONSTRAINT [Configuracion_id_df] DEFAULT 1,
    [toleranciaLlegadaMin] INT NOT NULL CONSTRAINT [Configuracion_toleranciaLlegadaMin_df] DEFAULT 10,
    [minMinutosAntesSalida] INT NOT NULL CONSTRAINT [Configuracion_minMinutosAntesSalida_df] DEFAULT 60,
    [exigenciaReconocimiento] VARCHAR(20) NOT NULL CONSTRAINT [Configuracion_exigenciaReconocimiento_df] DEFAULT 'equilibrado',
    [intentosAntesQr] INT NOT NULL CONSTRAINT [Configuracion_intentosAntesQr_df] DEFAULT 3,
    [jornadaMaximaHoras] INT NOT NULL CONSTRAINT [Configuracion_jornadaMaximaHoras_df] DEFAULT 9,
    [actualizadoEn] DATETIME2 NOT NULL,
    [actualizadoPor] NVARCHAR(1000),
    CONSTRAINT [Configuracion_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_nombre_idx] ON [dbo].[User]([nombre]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
