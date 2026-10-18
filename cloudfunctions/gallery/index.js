const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const DAY = 86400000;
const defaults = { advanceDays: 1, maxPeople: 4, contactName: '三尺美术馆', contactPhone: '', contactAddress: '', openingHours: '' };
function chinaDate(value = Date.now()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = key => p.find(x => x.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function validDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const t = Date.parse(`${s}T00:00:00+08:00`); return Number.isFinite(t) && chinaDate(t) === s; }
function tomorrowOffset(days) { return chinaDate(Date.now() + days * DAY); }
function nonnegativeDays(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : 1; }
function maxPeople(value) { const n = Number(value); return Number.isInteger(n) && n >= 1 ? n : 4; }
async function settings() {
  try { const x = await db.collection('settings').doc('main').get(); return { ...defaults, ...x.data }; }
  catch (_) { return defaults; }
}
async function getDoc(name, id) {
  try { return (await db.collection(name).doc(id).get()).data; }
  catch (_) { return null; }
}
async function listExhibitions() {
  const items = (await db.collection('exhibitions').where({ published: true }).limit(100).get()).data;
  const today = chinaDate();
  return items.filter(x => x.startDate && x.endDate).map(x => ({ ...x, phase: x.endDate < today ? 'past' : x.startDate > today ? 'upcoming' : 'current' }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
async function profile(openid) {
  const user = await getDoc('users', openid);
  const phoneVerified = !!(user && user.phoneVerified && user.phone);
  return user ? { name: user.name || '', phone: phoneVerified ? user.phone : '', phoneVerified, createdAt: user.createdAt } : { name: '', phone: '', phoneVerified: false };
}
async function saveProfile(openid, event) {
  const name = String(event.name || '').trim();
  if (name.length < 1 || name.length > 40) throw Error('请填写1至40字的昵称');
  const old = await getDoc('users', openid);
  const data = { name, updatedAt: db.serverDate() };
  if (old) await db.collection('users').doc(openid).update({ data });
  else await db.collection('users').add({ data: { _id: openid, ...data, createdAt: db.serverDate() } });
  return { name };
}
async function phoneFromWechat(openid, code) {
  if (!code) throw Error('未获得手机号授权');
  const result = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  const phone = result.phoneInfo && result.phoneInfo.purePhoneNumber;
  if (!phone) throw Error('获取手机号失败');
  const old = await getDoc('users', openid);
  const data = { phone, phoneVerified: true, phoneVerifiedAt: db.serverDate(), updatedAt: db.serverDate() };
  if (old) await db.collection('users').doc(openid).update({ data });
  else await db.collection('users').add({ data: { _id: openid, ...data, createdAt: db.serverDate() } });
  return { phone, phoneVerified: true };
}
function slotInfo(exhibit, date, time) {
  if (!validDate(date) || date < exhibit.startDate || date > exhibit.endDate) throw Error('预约日期不在可预约范围');
  const slot = (exhibit.dailySlots || []).find(x => x.time === time);
  if (!slot || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(slot.capacity) || slot.capacity < 1) throw Error('该时段不可预约');
  if (Date.parse(`${date}T${time}:00+08:00`) <= Date.now()) throw Error('不能预约已开始的时段');
  return slot;
}
async function availability(exhibitId, date) {
  const exhibit = await getDoc('exhibitions', exhibitId);
  if (!exhibit || !exhibit.published) throw Error('展览不存在');
  const config = await settings();
  if (!validDate(date) || date < exhibit.startDate || date > exhibit.endDate || date < tomorrowOffset(nonnegativeDays(config.advanceDays))) return [];
  const slots = exhibit.dailySlots || [];
  const ids = slots.map(x => `${exhibitId}_${date}_${x.time.replace(':', '')}`);
  const docs = await Promise.all(ids.map(id => getDoc('slots', id)));
  return slots.map((x, i) => ({ time: x.time, capacity: x.capacity, remaining: Date.parse(`${date}T${x.time}:00+08:00`) <= Date.now() ? 0 : Math.max(0, x.capacity - ((docs[i] && docs[i].reserved) || 0)) }));
}
async function reserve(openid, event) {
  const exhibit = await getDoc('exhibitions', event.exhibitionId);
  if (!exhibit || !exhibit.published) throw Error('展览不存在');
  const slot = slotInfo(exhibit, event.date, event.time);
  const people = Number(event.people);
  const config = await settings();
  const peopleLimit = maxPeople(config.maxPeople);
  if (!Number.isInteger(people) || people < 1 || people > peopleLimit) throw Error(`每次最多预约${peopleLimit}人`);
  if (event.date < tomorrowOffset(nonnegativeDays(config.advanceDays))) throw Error('请至少提前预约');
  const user = await getDoc('users', openid);
  if (!user || !user.name || !user.phone || user.phoneVerified !== true) throw Error('请先填写昵称并授权微信手机号');
  const guardId = `${openid}_${exhibit._id}_${event.date}`;
  const slotId = `${exhibit._id}_${event.date}_${event.time.replace(':', '')}`;
  const bookingId = `${guardId}_${Date.now()}`;
  await db.runTransaction(async tx => {
    const guard = await tx.collection('bookingGuards').doc(guardId).get().catch(() => null);
    if (guard && guard.data) throw Error('该展览当天已预约');
    const booked = await tx.collection('slots').doc(slotId).get().catch(() => null);
    const count = booked && booked.data ? booked.data.reserved : 0;
    if (count + people > slot.capacity) throw Error('该时段名额不足');
    if (booked && booked.data) await tx.collection('slots').doc(slotId).update({ data: { reserved: count + people } });
    else await tx.collection('slots').add({ data: { _id: slotId, exhibitionId: exhibit._id, date: event.date, time: event.time, reserved: people } });
    await tx.collection('bookingGuards').add({ data: { _id: guardId, bookingId } });
    await tx.collection('bookings').add({ data: { _id: bookingId, openid, exhibitionId: exhibit._id, exhibitionTitle: exhibit.title, date: event.date, time: event.time, people, name: user.name, phone: user.phone, status: 'active', createdAt: db.serverDate(), updatedAt: db.serverDate() } });
  });
  return { bookingId };
}
async function cancel(openid, id) {
  await db.runTransaction(async tx => {
    const result = await tx.collection('bookings').doc(id).get();
    const b = result.data;
    if (!b || b.openid !== openid) throw Error('预约不存在');
    if (b.status !== 'active') throw Error('预约已经取消');
    const slotId = `${b.exhibitionId}_${b.date}_${b.time.replace(':', '')}`;
    const guardId = `${openid}_${b.exhibitionId}_${b.date}`;
    const slot = await tx.collection('slots').doc(slotId).get();
    await tx.collection('slots').doc(slotId).update({ data: { reserved: Math.max(0, slot.data.reserved - b.people) } });
    await tx.collection('bookingGuards').doc(guardId).remove();
    await tx.collection('bookings').doc(id).update({ data: { status: 'cancelled', updatedAt: db.serverDate() } });
  });
  return true;
}
exports.main = async (event = {}) => {
  try {
    const openid = cloud.getWXContext().OPENID;
    if (!openid) throw Error('请在微信中打开小程序');
    let data;
    switch (event.action) {
      case 'home': data = { exhibitions: await listExhibitions(), settings: await settings() }; break;
      case 'exhibition': data = await getDoc('exhibitions', event.id); if (!data || !data.published) throw Error('展览不存在'); break;
      case 'settings': data = await settings(); break;
      case 'availability': data = await availability(event.exhibitionId, event.date); break;
      case 'profile': data = await profile(openid); break;
      case 'saveProfile': data = await saveProfile(openid, event); break;
      case 'wechatPhone': data = await phoneFromWechat(openid, event.code); break;
      case 'reserve': data = await reserve(openid, event); break;
      case 'myBookings': data = (await db.collection('bookings').where({ openid }).orderBy('createdAt', 'desc').limit(100).get()).data; break;
      case 'cancel': data = await cancel(openid, event.id); break;
      default: throw Error('未知操作');
    }
    return { ok: true, data };
  } catch (e) { console.error(e); return { ok: false, error: e.message || '服务暂不可用' }; }
};
