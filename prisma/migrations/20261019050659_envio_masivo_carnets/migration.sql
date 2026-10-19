BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[EnvioCarnets] (
    [id] NVARCHAR(1000) NOT NULL,
    [iniciadoPorId] NVARCHAR(1000) NOT NULL,
    [estado] VARCHAR(12) NOT NULL,
    [motivoPausa] NVARCHAR(300),
    [total] INT NOT NULL,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [EnvioCarnets_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [terminadoEn] DATETIME2,
    CONSTRAINT [EnvioCarnets_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EnvioCarnetItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [envioId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [estado] VARCHAR(10) NOT NULL,
    [motivoError] NVARCHAR(300),
    [intentadoEn] DATETIME2,
    CONSTRAINT [EnvioCarnetItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EnvioCarnetItem_envioId_userId_key] UNIQUE NONCLUSTERED ([envioId],[userId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EnvioCarnets_estado_idx] ON [dbo].[EnvioCarnets]([estado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EnvioCarnetItem_envioId_estado_idx] ON [dbo].[EnvioCarnetItem]([envioId], [estado]);

-- AddForeignKey
ALTER TABLE [dbo].[EnvioCarnets] ADD CONSTRAINT [EnvioCarnets_iniciadoPorId_fkey] FOREIGN KEY ([iniciadoPorId]) REFERENCES [dbo].[Admin]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EnvioCarnetItem] ADD CONSTRAINT [EnvioCarnetItem_envioId_fkey] FOREIGN KEY ([envioId]) REFERENCES [dbo].[EnvioCarnets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EnvioCarnetItem] ADD CONSTRAINT [EnvioCarnetItem_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
