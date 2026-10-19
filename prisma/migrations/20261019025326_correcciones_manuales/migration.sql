BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[AttendanceLog] ADD [anuladaEn] DATETIME2,
[anuladaPorId] NVARCHAR(1000),
[motivo] NVARCHAR(300),
[motivoAnulacion] NVARCHAR(300),
[reemplazaAId] NVARCHAR(1000),
[registradoPorId] NVARCHAR(1000);

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceLog] ADD CONSTRAINT [AttendanceLog_registradoPorId_fkey] FOREIGN KEY ([registradoPorId]) REFERENCES [dbo].[Admin]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceLog] ADD CONSTRAINT [AttendanceLog_anuladaPorId_fkey] FOREIGN KEY ([anuladaPorId]) REFERENCES [dbo].[Admin]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceLog] ADD CONSTRAINT [AttendanceLog_reemplazaAId_fkey] FOREIGN KEY ([reemplazaAId]) REFERENCES [dbo].[AttendanceLog]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
