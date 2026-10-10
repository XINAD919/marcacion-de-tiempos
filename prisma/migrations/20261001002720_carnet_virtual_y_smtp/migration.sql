BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[CarnetVirtual] (
    [userId] NVARCHAR(1000) NOT NULL,
    [token] VARCHAR(64) NOT NULL,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [CarnetVirtual_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [enviadoEn] DATETIME2,
    [enviadoA] NVARCHAR(1000),
    CONSTRAINT [CarnetVirtual_pkey] PRIMARY KEY CLUSTERED ([userId]),
    CONSTRAINT [CarnetVirtual_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[ConfiguracionSmtp] (
    [id] INT NOT NULL CONSTRAINT [ConfiguracionSmtp_id_df] DEFAULT 1,
    [host] NVARCHAR(1000) NOT NULL,
    [puerto] INT NOT NULL,
    [seguridad] VARCHAR(10) NOT NULL CONSTRAINT [ConfiguracionSmtp_seguridad_df] DEFAULT 'starttls',
    [usuario] NVARCHAR(1000),
    [passwordCifrada] VARCHAR(max),
    [remitenteNombre] NVARCHAR(1000) NOT NULL,
    [remitenteEmail] NVARCHAR(1000) NOT NULL,
    [actualizadoEn] DATETIME2 NOT NULL,
    [actualizadoPor] NVARCHAR(1000),
    CONSTRAINT [ConfiguracionSmtp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[CarnetVirtual] ADD CONSTRAINT [CarnetVirtual_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
