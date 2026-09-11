const older = ['MRX 310', 'MRX 510', 'MRX 710', 'MRX 520', 'MRX 720', 'MRX 1120', 'AVM 60'];
const newer = ['MRX 540', 'MRX 740', 'MRX 1140', 'MRX SLM', 'AVM 70', 'AVM 90'];

export function capabilities(model: string) {
  const normalized = model.trim();
  if (!older.includes(normalized) && !newer.includes(normalized)) throw new Error(`Unsupported Anthem model: ${normalized.slice(0, 80)}`);
  const modern = newer.includes(normalized);
  return { model: normalized, protocol: modern ? 2 : 1, zones: normalized === 'MRX SLM' ? 1 : 2,
    brightness: modern, volume: modern, dolby: modern, directListeningMode: modern, arc: true };
}
