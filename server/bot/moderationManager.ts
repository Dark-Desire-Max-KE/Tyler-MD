import fs from 'node:fs';
import path from 'node:path';

interface WarningRecord {
  count: number;
  reasons: string[];
  updatedAt: string;
}

interface ModerationState {
  warnings: Record<string, Record<string, WarningRecord>>;
  badWords: Record<string, string[]>;
  warningLimits: Record<string, number>;
}

const emptyState = (): ModerationState => ({ warnings: {}, badWords: {}, warningLimits: {} });

export class ModerationManager {
  private state: ModerationState;

  constructor(private readonly filePath = path.resolve(process.cwd(), 'session_data', 'moderation.json')) {
    this.state = this.load();
  }

  public addWarning(groupJid: string, participantJid: string, reason: string, amount = 1): WarningRecord {
    const group = this.state.warnings[groupJid] ||= {};
    const current = group[participantJid] || { count: 0, reasons: [], updatedAt: '' };
    const updated: WarningRecord = {
      count: current.count + amount,
      reasons: [...current.reasons, reason].slice(-20),
      updatedAt: new Date().toISOString()
    };
    group[participantJid] = updated;
    this.save();
    return updated;
  }

  public getWarning(groupJid: string, participantJid: string): WarningRecord {
    return this.state.warnings[groupJid]?.[participantJid] || { count: 0, reasons: [], updatedAt: '' };
  }

  public listWarnings(groupJid: string): Array<{ participantJid: string } & WarningRecord> {
    return Object.entries(this.state.warnings[groupJid] || {})
      .map(([participantJid, record]) => ({ participantJid, ...record }))
      .sort((left, right) => right.count - left.count);
  }

  public clearWarning(groupJid: string, participantJid: string): boolean {
    const group = this.state.warnings[groupJid];
    if (!group || !group[participantJid]) return false;
    delete group[participantJid];
    this.save();
    return true;
  }

  public clearGroupWarnings(groupJid: string): void {
    delete this.state.warnings[groupJid];
    this.save();
  }

  public getWarningLimit(groupJid: string): number {
    return this.state.warningLimits[groupJid] || 3;
  }

  public setWarningLimit(groupJid: string, limit: number): void {
    this.state.warningLimits[groupJid] = limit;
    this.save();
  }

  public listBadWords(groupJid: string): string[] {
    return [...(this.state.badWords[groupJid] || [])];
  }

  public addBadWord(groupJid: string, word: string): boolean {
    const normalized = word.trim().toLowerCase();
    if (!normalized || normalized.length > 40) return false;
    const words = this.state.badWords[groupJid] ||= [];
    if (words.includes(normalized)) return false;
    words.push(normalized);
    this.save();
    return true;
  }

  public removeBadWord(groupJid: string, word: string): boolean {
    const words = this.state.badWords[groupJid] || [];
    const index = words.indexOf(word.trim().toLowerCase());
    if (index === -1) return false;
    words.splice(index, 1);
    this.save();
    return true;
  }

  public findBadWord(groupJid: string, text: string): string | undefined {
    const words = this.state.badWords[groupJid] || [];
    const normalizedText = text.toLowerCase();
    return words.find(word => new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(word)}($|[^\\p{L}\\p{N}_])`, 'u').test(normalizedText));
  }

  private load(): ModerationState {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<ModerationState>;
      return {
        warnings: parsed.warnings || {},
        badWords: parsed.badWords || {},
        warningLimits: parsed.warningLimits || {}
      };
    } catch {
      return emptyState();
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const moderationManager = new ModerationManager();