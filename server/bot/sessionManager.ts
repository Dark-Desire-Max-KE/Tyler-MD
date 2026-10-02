import fs from 'fs';
import path from 'path';

export class SessionManager {
  private sessionDir: string;

  constructor(sessionDir = path.resolve(process.cwd(), 'session_data')) {
    this.sessionDir = sessionDir;
    if (!fs.existsSync(this.sessionDir)) {
      try {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create session directory:', e);
      }
    }
  }

  public getSessionDir(): string {
    return this.sessionDir;
  }

  public hasActiveSession(): boolean {
    const credsPath = path.join(this.sessionDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
      const content = fs.readFileSync(credsPath, 'utf8');
      const parsed = JSON.parse(content);
      return Boolean(parsed.me?.id || parsed.registered);
    } catch {
      return false;
    }
  }

  public getSessionInfo(): {
    exists: boolean;
    registered: boolean;
    userJid?: string;
    userName?: string;
    fileCount: number;
    sizeKb: number;
    platform?: string;
  } {
    if (!fs.existsSync(this.sessionDir)) {
      return { exists: false, registered: false, fileCount: 0, sizeKb: 0 };
    }

    try {
      const files = fs.readdirSync(this.sessionDir);
      let totalSize = 0;
      for (const file of files) {
        const stats = fs.statSync(path.join(this.sessionDir, file));
        totalSize += stats.size;
      }

      const credsPath = path.join(this.sessionDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        return {
          exists: true,
          registered: Boolean(creds.registered || creds.me?.id),
          userJid: creds.me?.id,
          userName: creds.me?.name || creds.me?.notify,
          fileCount: files.length,
          sizeKb: Math.round(totalSize / 1024),
          platform: creds.platform || 'MultiDevice-Baileys'
        };
      }

      return {
        exists: files.length > 0,
        registered: false,
        fileCount: files.length,
        sizeKb: Math.round(totalSize / 1024)
      };
    } catch (err) {
      return { exists: false, registered: false, fileCount: 0, sizeKb: 0 };
    }
  }

  public exportSessionString(): string | null {
    const credsPath = path.join(this.sessionDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return null;
    try {
      const credsData = fs.readFileSync(credsPath, 'utf8');
      const base64 = Buffer.from(credsData).toString('base64');
      return `NEXUS-MD;;;${base64}`;
    } catch {
      return null;
    }
  }

  public importSessionString(sessionStr: string): boolean {
    try {
      let rawJson = '';
      if (sessionStr.startsWith('NEXUS-MD;;;')) {
        const b64 = sessionStr.replace('NEXUS-MD;;;', '').trim();
        rawJson = Buffer.from(b64, 'base64').toString('utf8');
      } else {
        // Maybe direct JSON or plain base64
        try {
          rawJson = Buffer.from(sessionStr.trim(), 'base64').toString('utf8');
          JSON.parse(rawJson); // test
        } catch {
          rawJson = sessionStr.trim();
        }
      }

      const parsed = JSON.parse(rawJson);
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }
      fs.writeFileSync(path.join(this.sessionDir, 'creds.json'), JSON.stringify(parsed, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to import session string:', err);
      return false;
    }
  }

  public clearSession(): boolean {
    try {
      if (fs.existsSync(this.sessionDir)) {
        const files = fs.readdirSync(this.sessionDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.sessionDir, file));
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to clear session:', err);
      return false;
    }
  }
}

export const sessionManager = new SessionManager();
