const DEFAULT_START = 10;
const DEFAULT_END = 17;
const DEFAULT_CAPACITY = 12;

function hourLabel(hour) { return `${String(hour).padStart(2, '0')}:00`; }

function buildSlots(start, end, capacity) {
  const first = Number(start);
  const last = Number(end);
  const limit = Number(capacity);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last > 24 || first >= last || !Number.isInteger(limit) || limit < 1 || limit > 10000) throw Error('请检查开始、结束时间和每时段人数');
  return Array.from({ length: last - first }, (_, index) => ({ time: hourLabel(first + index), capacity: limit }));
}

function scheduleFromSlots(slots) {
  if (!Array.isArray(slots) || !slots.length) return { start: DEFAULT_START, end: DEFAULT_END, capacity: DEFAULT_CAPACITY, irregular: false };
  const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
  const start = Number(sorted[0].time.slice(0, 2));
  const end = Number(sorted[sorted.length - 1].time.slice(0, 2)) + 1;
  const capacity = Number(sorted[0].capacity);
  const expected = buildSlots(start, end, capacity);
  const irregular = expected.length !== sorted.length || expected.some((slot, index) => slot.time !== sorted[index].time || slot.capacity !== sorted[index].capacity);
  return { start, end, capacity, irregular };
}

module.exports = { DEFAULT_START, DEFAULT_END, DEFAULT_CAPACITY, hourLabel, buildSlots, scheduleFromSlots };
