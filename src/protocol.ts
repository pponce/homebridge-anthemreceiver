import { StringDecoder } from 'node:string_decoder';

/** TCP is a byte stream: a data event is not a complete receiver reply. */
export class ResponseFramer {
  private decoder = new StringDecoder('utf8');
  private pending = '';
  constructor(private readonly limit = 65536) {}

  push(data: Buffer): string[] {
    this.pending += this.decoder.write(data);
    const replies: string[] = [];
    let end: number;
    while ((end = this.pending.indexOf(';')) !== -1) {
      if (end > this.limit) { this.reset(); throw new Error('Receiver reply exceeds buffer limit'); }
      const reply = this.pending.slice(0, end).trim();
      this.pending = this.pending.slice(end + 1);
      if (reply) replies.push(reply);
    }
    if (this.pending.length > this.limit) { this.reset(); throw new Error('Receiver reply exceeds buffer limit'); }
    return replies;
  }

  reset(): void { this.pending = ''; this.decoder = new StringDecoder('utf8'); }
}

export const MAX_INPUTS = 64;

/** Validate numeric fields before allocating arrays or updating HomeKit state. */
export function validateReply(reply: string): void {
  if (reply.startsWith('ICN') && !/^ICN\d+$/.test(reply)) throw new Error('Invalid receiver input count');
  if (reply.startsWith('ICN')) {
    const count = Number(reply.slice(3));
    if (count < 1 || count > MAX_INPUTS) throw new Error('Receiver input count is out of range');
  }
  const rules: Array<[RegExp, RegExp, number, number]> = [
    [/^Z[12]POW/, /^Z[12]POW([01])$/, 0, 1],
    [/^Z[12]MUT/, /^Z[12]MUT([01])$/, 0, 1],
    [/^Z[12]INP/, /^Z[12]INP(\d+)$/, 1, MAX_INPUTS],
    [/^Z[12]PVOL/, /^Z[12]PVOL(\d+(?:\.\d+)?)$/, 0, 100],
    [/^Z[12]VOL/, /^Z[12]VOL([+-]?\d+(?:\.\d+)?)$/, -100, 20],
    [/^Z[12]ALM/, /^Z[12]ALM(\d+)$/, 0, 16],
    [/^GCFPB/, /^GCFPB(\d+)$/, 0, 100],
    [/^GCLEDB/, /^GCLEDB(\d+)$/, 0, 100],
  ];
  for (const [prefix, pattern, min, max] of rules) {
    if (!prefix.test(reply)) continue;
    const match = pattern.exec(reply);
    if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) < min || Number(match[1]) > max) {
      throw new Error('Malformed receiver state reply');
    }
  }
  const input = /^IS(\d+)(IN|ARC|DV)/.exec(reply) || /^ISN(\d{2})/.exec(reply);
  if (input && (Number(input[1]) < 1 || Number(input[1]) > MAX_INPUTS)) throw new Error('Invalid input identifier');
  if (/^IS\d+ARC/.test(reply) && !/^IS\d+ARC[01]$/.test(reply)) throw new Error('Invalid ARC reply');
  if (/^IS\d+DV/.test(reply) && !/^IS\d+DV[0-3]$/.test(reply)) throw new Error('Invalid Dolby reply');
}
