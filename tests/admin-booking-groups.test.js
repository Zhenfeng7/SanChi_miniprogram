const assert = require('node:assert/strict');
const { beijingDate, groupBookings } = require('../miniprogram/utils/admin-booking-groups');

assert.equal(beijingDate(Date.parse('2026-11-01T15:30:00Z')), '2026-11-01');
assert.equal(beijingDate(Date.parse('2026-11-01T16:30:00Z')), '2026-11-02');

const bookings = [
  { _id: 'future', date: '2026-11-02', time: '10:00', status: 'active' },
  { _id: 'today-late', date: '2026-11-01', time: '15:00', status: 'active' },
  { _id: 'today-early', date: '2026-11-01', time: '10:00', status: 'active' },
  { _id: 'cancelled', date: '2026-11-01', time: '12:00', status: 'cancelled' },
  { _id: 'week-edge', date: '2026-10-25', time: '10:00', status: 'active' },
  { _id: 'older', date: '2026-10-24', time: '10:00', status: 'active' },
  { _id: 'older-cancelled', date: '2026-10-23', time: '10:00', status: 'cancelled' }
];
const current = groupBookings(bookings, '2026-11-01', false);
assert.deepEqual(current.todayBookings.map(x => x._id), ['today-early', 'today-late']);
assert.deepEqual(current.futureBookings.map(x => x._id), ['future']);
assert.deepEqual(current.pastWeekBookings, []);
assert.deepEqual(current.olderBookings, []);
const all = groupBookings(bookings, '2026-11-01', true);
assert.deepEqual(all.todayBookings.map(x => x._id), ['today-early', 'cancelled', 'today-late']);
assert.deepEqual(all.pastWeekBookings.map(x => x._id), ['week-edge']);
assert.deepEqual(all.olderBookings.map(x => x._id), ['older', 'older-cancelled']);
assert.equal(all.todayBookings.length + all.futureBookings.length + all.pastWeekBookings.length + all.olderBookings.length, bookings.length);
