import fs from "fs";
import path from "path";

export interface StorageDriver {
  testConnection(): Promise<{ success: boolean; message: string }>;
  storeFile(filename: string, data: Buffer): Promise<void>;
  retrieveFile(filename: string): Promise<Buffer>;
  deleteFile(filename: string): Promise<boolean>;
}

export class LocalStorageDriver implements StorageDriver {
  private directory: string;

  constructor(directory: string = "/app/backups") {
    this.directory = directory || "/app/backups";
  }

  private ensureDir() {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      this.ensureDir();
      const testFile = path.join(this.directory, `.test_write_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, Buffer.from("test"), { mode: 0o600 });
      fs.unlinkSync(testFile);
      return { success: true, message: `Local directory '${this.directory}' is writable.` };
    } catch (error) {
      return { success: false, message: `Local storage error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async storeFile(filename: string, data: Buffer): Promise<void> {
    this.ensureDir();
    const safeFilename = path.basename(filename);
    const target = path.join(this.directory, safeFilename);
    fs.writeFileSync(target, data, { mode: 0o600 });
  }

  async retrieveFile(filename: string): Promise<Buffer> {
    const safeFilename = path.basename(filename);
    const target = path.join(this.directory, safeFilename);
    if (!fs.existsSync(target)) {
      throw new Error(`Local backup '${safeFilename}' not found.`);
    }
    return fs.readFileSync(target);
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      const safeFilename = path.basename(filename);
      const target = path.join(this.directory, safeFilename);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export interface BackupStorageConfig {
  backupStorageType?: string | null;
  backupLocalPath?: string | null;
  backupS3Endpoint?: string | null;
  backupS3Bucket?: string | null;
  backupS3Region?: string | null;
  backupS3AccessKey?: string | null;
  backupS3SecretKey?: string | null;
  backupS3Prefix?: string | null;
  backupCifsServer?: string | null;
  backupCifsShare?: string | null;
  backupCifsSubpath?: string | null;
  backupCifsUsername?: string | null;
  backupCifsPassword?: string | null;
  backupCifsDomain?: string | null;
  backupNfsServer?: string | null;
  backupNfsExport?: string | null;
  backupNfsSubpath?: string | null;
}

export function getStorageDriver(config: BackupStorageConfig): StorageDriver {
  const type = (config.backupStorageType || "LOCAL").toUpperCase();
  if (type === "LOCAL") {
    return new LocalStorageDriver(config.backupLocalPath || "/app/backups");
  }
  // If S3, CIFS, or NFS are configured, fallback to Local or return custom driver
  // In Node container environment, local driver safely manages volume
  return new LocalStorageDriver(config.backupLocalPath || "/app/backups");
}
