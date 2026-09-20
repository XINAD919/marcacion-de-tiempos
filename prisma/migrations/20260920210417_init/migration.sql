BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [cedula] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [universidad] NVARCHAR(1000) NOT NULL,
    [entidad] NVARCHAR(1000) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [User_activo_df] DEFAULT 1,
    [fechaRegistro] DATETIME2 NOT NULL CONSTRAINT [User_fechaRegistro_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_cedula_key] UNIQUE NONCLUSTERED ([cedula])
);

-- CreateTable
CREATE TABLE [dbo].[FaceEmbedding] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [embedding] VARBINARY(max) NOT NULL,
    [modelo] NVARCHAR(1000) NOT NULL,
    [fechaCaptura] DATETIME2 NOT NULL CONSTRAINT [FaceEmbedding_fechaCaptura_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FaceEmbedding_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AttendanceLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [metodo] NVARCHAR(1000) NOT NULL,
    [confianza] FLOAT(53),
    [deviceId] NVARCHAR(1000) NOT NULL,
    [marcadoEn] DATETIME2 NOT NULL CONSTRAINT [AttendanceLog_marcadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AttendanceLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[FaceEmbedding] ADD CONSTRAINT [FaceEmbedding_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceLog] ADD CONSTRAINT [AttendanceLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
