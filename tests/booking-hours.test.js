const assert = require('node:assert/strict');
const { buildSlots, scheduleFromSlots } = require('../miniprogram/utils/booking-hours');

const defaults = buildSlots(10, 17, 12);
assert.deepEqual(defaults.map(slot => slot.time), ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
assert.ok(defaults.every(slot => slot.capacity === 12));
assert.deepEqual(scheduleFromSlots(defaults), { start: 10, end: 17, capacity: 12, irregular: false });
assert.equal(scheduleFromSlots([{ time: '10:00', capacity: 12 }, { time: '14:00', capacity: 12 }]).irregular, true);
assert.throws(() => buildSlots(17, 10, 12));
assert.throws(() => buildSlots(10, 17, 0));
