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
  tables.settings.set('main', { _id: 'main', adminOwnerOpenid: 'owner', adminOpenids: ['owner'] });
  openid = 'owner';
  assert.equal((await call('adminStatus')).data.isAdmin, true);
  assert.equal((await call('adminStatus')).data.isOwner, true);
  assert.equal((await call('adminStatus')).data.canManageAdmins, true);
  assert.equal((await call('settings')).data.adminOpenids, undefined);
  assert.equal((await call('settings')).data.adminOwnerOpenid, undefined);
  assert.equal((await call('settings')).data.adminManagerOpenids, undefined);
  tables.users.set('staff', { _id: 'staff', name: '馆员', phone: '13800138001', phoneVerified: true });
  tables.users.set('helper', { _id: 'helper', name: '协助馆员', phone: '13800138002', phoneVerified: true });
  tables.users.set('third', { _id: 'third', name: '第三馆员', phone: '13800138003', phoneVerified: true });
  assert.equal((await call('adminLookupUser', { phone: '13800138001' })).data.openid, 'staff');
  assert.equal((await call('adminSetMember', { openid: 'staff', enabled: true })).ok, true);
  openid = 'staff';
  assert.equal((await call('adminStatus')).data.isAdmin, true);
  assert.equal((await call('adminStatus')).data.isOwner, false);
  assert.equal((await call('adminStatus')).data.canManageAdmins, false);
  assert.equal((await call('adminMembers')).ok, false);
  assert.equal((await call('adminSetMember', { openid: 'visitor', enabled: true })).ok, false);
  openid = 'owner';
  assert.equal((await call('adminMembers')).data.length, 2);
  assert.equal((await call('adminSetAccountManager', { openid: 'staff', enabled: true })).ok, true);
  openid = 'staff';
  assert.equal((await call('adminStatus')).data.canManageAdmins, true);
  assert.equal((await call('adminMembers')).data.find(x => x.openid === 'staff').canManageAdmins, true);
  assert.equal((await call('adminLookupUser', { phone: '13800138002' })).data.openid, 'helper');
  assert.equal((await call('adminSetMember', { openid: 'helper', enabled: true })).ok, true);
  assert.equal((await call('adminSetAccountManager', { openid: 'helper', enabled: true })).ok, true);
  assert.equal((await call('adminSetMember', { openid: 'owner', enabled: false })).ok, false);
  assert.equal((await call('adminSetAccountManager', { openid: 'owner', enabled: false })).ok, false);
  assert.equal((await call('adminSetAccountManager', { openid: 'staff', enabled: false })).ok, false);
  openid = 'helper';
  assert.equal((await call('adminStatus')).data.canManageAdmins, true);
  assert.equal((await call('adminSetMember', { openid: 'third', enabled: true })).ok, true);
  assert.equal((await call('adminSetAccountManager', { openid: 'staff', enabled: false })).ok, true);
  openid = 'staff';
  assert.equal((await call('adminStatus')).data.isAdmin, true);
  assert.equal((await call('adminStatus')).data.canManageAdmins, false);
  assert.equal((await call('adminMembers')).ok, false);
  openid = 'owner';
  assert.equal((await call('adminSetMember', { openid: 'helper', enabled: false })).ok, true);
  openid = 'helper';
  assert.equal((await call('adminStatus')).data.isAdmin, false);
  assert.equal((await call('adminStatus')).data.canManageAdmins, false);
  openid = 'owner';
  assert.equal((await call('adminSaveExhibition', { exhibition: { ...exhibit, title: '' } })).ok, false);
  assert.equal((await call('adminSaveSettings', { settings: { advanceDays: 1, maxPeople: 4, contactName: '三尺', bannerImages: [] } })).ok, true);
  assert.equal(tables.settings.get('main').adminOwnerOpenid, 'owner');
  const create = await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '10:00', people: 2, name: '访客甲', phone: '13800138000' });
  assert.equal(create.ok, true, create.error);
  tables.bookings.set('visitor-booking', { _id: 'visitor-booking', openid: 'visitor', exhibitionId: 'ex1', exhibitionTitle: '测试展览', date: '2020-01-02', time: '10:00', people: 1, status: 'cancelled' });
  const renamed = await call('adminSaveExhibition', { id: 'ex1', exhibition: { ...exhibit, title: '改名后的展览' } });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(tables.bookings.get(create.data.bookingId).exhibitionTitle, '测试展览');
  assert.equal((await call('adminBookings')).data.find(x => x._id === create.data.bookingId).exhibitionTitle, '改名后的展览');
  openid = 'visitor';
  assert.equal((await call('myBookings')).data.find(x => x._id === 'visitor-booking').exhibitionTitle, '改名后的展览');
  openid = 'owner';
  assert.equal(tables.slots.get('ex1_2099-01-02_1000').reserved, 2);
  const duplicate = await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '11:00', people: 1, name: '访客甲', phone: '13800138000' });
  assert.equal(duplicate.ok, false);
  assert.equal((await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-02', time: '10:00', people: 2, name: '访客乙', phone: '13900139000' })).ok, false);
  const change = await call('adminUpdateBooking', { id: create.data.bookingId, date: '2099-01-03', time: '11:00', people: 3, name: '访客甲', phone: '13800138000' });
  assert.equal(change.ok, true, change.error);
  assert.equal(tables.slots.get('ex1_2099-01-02_1000').reserved, 0);
  assert.equal(tables.slots.get('ex1_2099-01-03_1100').reserved, 3);
  assert.equal((await call('adminSaveExhibition', { id: 'ex1', exhibition: { ...exhibit, dailySlots: [{ time: '10:00', capacity: 3 }, { time: '11:00', capacity: 2 }] } })).ok, false);
  tables.bookings.set('past-booking', { _id: 'past-booking', exhibitionId: 'ex1', date: '2020-01-01', time: '10:00', people: 1, name: '旧访客', phone: '13700137000', status: 'active' });
  tables.slots.set('ex1_2020-01-01_1000', { _id: 'ex1_2020-01-01_1000', exhibitionId: 'ex1', date: '2020-01-01', time: '10:00', reserved: 1 });
  const archive = await call('adminDeleteExhibition', { id: 'ex1' });
  assert.equal(archive.ok, true, archive.error);
  assert.equal(archive.data.cancelledCount, 1);
  assert.equal(tables.exhibitions.get('ex1').published, false);
  assert.equal(tables.exhibitions.get('ex1').archived, true);
  assert.equal((await call('adminExhibitions')).data.some(x => x._id === 'ex1'), false);
  assert.equal(tables.bookings.get(create.data.bookingId).status, 'cancelled');
  assert.equal(tables.bookings.get('past-booking').status, 'active');
  assert.equal((await call('adminBookings')).data.some(x => x._id === create.data.bookingId), true);
  assert.equal((await call('adminBookings')).data.find(x => x._id === create.data.bookingId).exhibitionTitle, '改名后的展览');
  openid = 'visitor';
  assert.equal((await call('myBookings')).data.find(x => x._id === 'visitor-booking').exhibitionTitle, '改名后的展览');
  openid = 'owner';
  assert.equal(tables.slots.get('ex1_2099-01-03_1100').reserved, 0);
  assert.equal(tables.slots.get('ex1_2020-01-01_1000').reserved, 1);
  assert.equal(tables.bookingGuards.size, 0);
  assert.equal((await call('adminCreateBooking', { exhibitionId: 'ex1', date: '2099-01-04', time: '10:00', people: 1, name: '访客乙', phone: '13900139000' })).ok, false);
  assert.equal((await call('adminDeleteExhibition', { id: 'ex1' })).data.cancelledCount, 0);
  console.log('admin cloud actions: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
