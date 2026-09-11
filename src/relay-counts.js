export function observeCoverage(coverage, event) {
  coverage.eventIds ||= new Set();
  coverage.deletionIds ||= new Set();
  (event.kind === 5 ? coverage.deletionIds : coverage.eventIds).add(event.id);
}

export function updateDeletionCoverage(coverage, progress) {
  if (progress.ack === 'Request accepted') observeCoverage(coverage, progress.receipt);
  for (const record of progress.current) {
    const state = record.deletion?.[progress.relay]?.state;
    if (state === 'removed') coverage.eventIds?.delete(record.event.id);
    else if (state === 'present') observeCoverage(coverage, record.event);
  }
}
