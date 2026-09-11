export function deletionStatus(record) {
  if (!record.deletion) return null;
  const results = Object.values(record.deletion);
  if (results.some(r => r.state === 'pending')) return { state: 'pending', label: 'Checking deletion…' };
  const present = results.filter(r => r.state === 'present').length;
  const unknown = results.filter(r => r.state === 'unknown').length;
  if (present) return { state: 'present', label: `Still on ${present} ${present === 1 ? 'relay' : 'relays'}${unknown ? ' · checks incomplete' : ''}` };
  if (unknown || !results.length) return { state: 'unknown', label: 'Deletion not fully verified' };
  return { state: 'removed', label: 'No longer returned by checked relays' };
}
