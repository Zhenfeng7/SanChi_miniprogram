const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const tables = Object.fromEntries(['exhibitions', 'settings', 'users', 'bookings', 'slots', 'bookingGuards'].map(x => [x, new Map()]));
let openid = 'visitor';
function collection(name, query = {}, offset = 0, size = Infinity) {
  const table = tables[name];
  if (!table) throw Error(`Missing collection ${name}`);
  return {
    doc(id) { return { get: async () => { if (!table.has(id)) throw Error('not found'); return { data: { ...table.get(id) } }; }, update: async ({ data }) => { if (!table.has(id)) throw Error('not found'); table.set(id, { ...table.get(id), ...data }); }, remove: async () => { table.delete(id); } }; },
    add: async ({ data }) => { const id = data._id || `generated-${table.size + 1}`; if (table.has(id)) throw Error('duplicate'); table.set(id, { ...data, _id: id }); return { _id: id }; },
    where(filter) { return collection(name, filter, offset, size); },
    skip(n) { return collection(name, query, n, size); },
    limit(n) { return collection(name, query, offset, n); },
    orderBy() { return this; },
    get: async () => ({ data: [...table.values()].filter(row => Object.keys(query).every(key => row[key] === query[key])).slice(offset, offset + size).map(x => ({ ...x })) })
  };
}
const db = { collection, serverDate: () => new Date(), runTransaction: fn => fn(db) };
const cloud = { DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) };
const code = fs.readFileSync(path.join(__dirname, '../cloudfunctions/gallery/index.js'), 'utf8');
const context = { require: name => { assert.equal(name, 'wx-server-sdk'); return cloud; }, exports: {}, console: { error() {} }, Intl, Date, Set, Math };
vm.runInNewContext(code, context);
const call = (action, data = {}) => context.exports.main({ action, ...data });

(async () => {
  const exhibit = { _id: 'ex1', title: '测试展览', description: '', startDate: '2099-01-01', endDate: '2099-12-31', dailySlots: [{ time: '10:00', capacity: 3 }, { time: '11:00', capacity: 3 }], published: true };
  tables.exhibitions.set('ex1', exhibit);
  assert.equal((await call('adminStatus')).data.isAdmin, false);
  assert.equal((await call('adminExhibitions')).ok, false);
  assert.equal((await call('adminSaveSettings', { settings: { advanceDays: 0, maxPeople: 4 } })).ok, false);
  tables.settings.set('main', { _id: 'main', adminOpenid: 'owner' });
  openid = 'owner';
  assert.equal((await call('adminStatus')).data.isAdmin, true);
  assert.equal((await call('settings')).data.adminOpenid, undefined);
  assert.equal((await call('adminSaveExhibition', { exhibition: { ...exhibit, title: '' } })).ok, false);
  assert.equal((await call('adminSaveSettings', { settings: { advanceDays: 1, maxPeople: 4, contactName: '三尺', bannerImages: [] } })).ok, true);
  assert.equal(tables.settings.get('main').adminOpenid, 'owner');
  const create = await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '10:00', people: 2, name: '访客甲', phone: '13800138000' });
  assert.equal(create.ok, true, create.error);
  assert.equal(tables.slots.get('ex1_2099-01-02_1000').reserved, 2);
  const duplicate = await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '11:00', people: 1, name: '访客甲', phone: '13800138000' });
  assert.equal(duplicate.ok, false);
  assert.equal((await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '10:00', people: 2, name: '访客乙', phone: '13900139000' })).ok, false);
  const change = await call('adminUpdateBooking', { id: create.data.bookingId, date: '2099-01-03', time: '11:00', people: 3, name: '访客甲', phone: '13800138000' });
  assert.equal(change.ok, true, change.error);
  assert.equal(tables.slots.get('ex1_2099-01-02_1000').reserved, 0);
  assert.equal(tables.slots.get('ex1_2099-01-03_1100').reserved, 3);
  assert.equal((await call('adminSaveExhibition', { id: 'ex1', exhibition: { ...exhibit, dailySlots: [{ time: '10:00', capacity: 3 }, { time: '11:00', capacity: 2 }] } })).ok, false);
  assert.equal((await call('adminDeleteExhibition', { id: 'ex1' })).ok, false);
  assert.equal((await call('adminCancelBooking', { id: create.data.bookingId })).ok, true);
  assert.equal(tables.slots.get('ex1_2099-01-03_1100').reserved, 0);
  assert.equal((await call('adminDeleteExhibition', { id: 'ex1' })).ok, true);
  console.log('admin cloud actions: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
