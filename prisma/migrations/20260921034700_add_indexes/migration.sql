BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [AttendanceLog_userId_marcadoEn_idx] ON [dbo].[AttendanceLog]([userId], [marcadoEn]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FaceEmbedding_userId_idx] ON [dbo].[FaceEmbedding]([userId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
