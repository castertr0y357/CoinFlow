-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiBaseUrl" TEXT,
ADD COLUMN     "aiChatId" TEXT,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiThinkingEffort" TEXT,
ADD COLUMN     "aiThinkingEnabled" BOOLEAN NOT NULL DEFAULT false;
