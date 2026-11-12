const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const DAY = 86400000;
const defaults = { advanceDays: 1, maxPeople: 4, contactName: '三尺美术馆', contactPhone: '', contactAddress: '', openingHours: '', bannerImages: [] };
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
  try { const x = await db.collection('settings').doc('main').get(); const { adminOpenid, adminOpenids, adminOwnerOpenid, adminManagerOpenids, ...publicSettings } = x.data; return { ...defaults, ...publicSettings }; }
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
  if ((await db.collection('bookings').where({ exhibitionId: exhibit._id, date: event.date, phone: user.phone, status: 'active' }).limit(1).get()).data.length) throw Error('该手机号在此展览当天已预约');
  const guardId = `${openid}_${exhibit._id}_${event.date}`;
  const phoneGuardId = phoneGuard(user.phone, exhibit._id, event.date);
  const slotId = `${exhibit._id}_${event.date}_${event.time.replace(':', '')}`;
  const bookingId = `${guardId}_${Date.now()}`;
  await db.runTransaction(async tx => {
    const currentExhibit = await tx.collection('exhibitions').doc(exhibit._id).get();
    if (!currentExhibit.data || !currentExhibit.data.published || currentExhibit.data.archived) throw Error('展览已下架');
    const guard = await tx.collection('bookingGuards').doc(guardId).get().catch(() => null);
    if (guard && guard.data) throw Error('该展览当天已预约');
    const phoneBooked = await tx.collection('bookingGuards').doc(phoneGuardId).get().catch(() => null);
    if (phoneBooked && phoneBooked.data) throw Error('该手机号在此展览当天已预约');
    const booked = await tx.collection('slots').doc(slotId).get().catch(() => null);
    const count = booked && booked.data ? booked.data.reserved : 0;
    if (count + people > slot.capacity) throw Error('该时段名额不足');
    if (booked && booked.data) await tx.collection('slots').doc(slotId).update({ data: { reserved: count + people } });
    else await tx.collection('slots').add({ data: { _id: slotId, exhibitionId: exhibit._id, date: event.date, time: event.time, reserved: people } });
    await tx.collection('bookingGuards').add({ data: { _id: guardId, bookingId } });
    await tx.collection('bookingGuards').add({ data: { _id: phoneGuardId, bookingId } });
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
    const phoneId = phoneGuard(b.phone, b.exhibitionId, b.date);
    const phoneRecord = await tx.collection('bookingGuards').doc(phoneId).get().catch(() => null);
    if (phoneRecord && phoneRecord.data && phoneRecord.data.bookingId === id) await tx.collection('bookingGuards').doc(phoneId).remove();
    await tx.collection('bookings').doc(id).update({ data: { status: 'cancelled', updatedAt: db.serverDate() } });
  });
  return true;
}
function phoneGuard(phone, exhibitionId, date) {
  return `phone_${String(phone).replace(/\D/g, '')}_${exhibitionId}_${date}`;
}
function phase(x) {
  const today = chinaDate();
  return x.endDate < today ? 'past' : x.startDate > today ? 'upcoming' : 'current';
}
function adminIds(config) {
  return [...new Set([config && config.adminOwnerOpenid, config && config.adminOpenid, ...(config && Array.isArray(config.adminOpenids) ? config.adminOpenids : [])].filter(x => typeof x === 'string' && x))];
}
function ownerId(config) { return config && (config.adminOwnerOpenid || config.adminOpenid); }
function accountManagerIds(config) {
  const admins = adminIds(config);
  return [...new Set([ownerId(config), ...(config && Array.isArray(config.adminManagerOpenids) ? config.adminManagerOpenids : [])].filter(id => admins.includes(id)))];
}
async function requireAdmin(openid) {
  const config = await getDoc('settings', 'main');
  if (!adminIds(config).includes(openid)) throw Error('没有馆方管理权限');
}
async function requireAccountManager(openid) {
  const config = await getDoc('settings', 'main');
  if (!accountManagerIds(config).includes(openid)) throw Error('没有管理员账号管理权限');
  return config;
}
async function adminMembers(openid) {
  const config = await requireAccountManager(openid);
  const owner = ownerId(config);
  const managers = accountManagerIds(config);
  return Promise.all(adminIds(config).map(async id => {
    const user = await getDoc('users', id);
    return { openid: id, name: user && user.name || '未设置昵称', phone: user && user.phoneVerified ? user.phone : '', isOwner: id === owner, canManageAdmins: managers.includes(id) };
  }));
}
async function adminLookupUser(openid, phone) {
  await requireAccountManager(openid);
  const targetPhone = cleanText(phone, '手机号', 30, true);
  if (!/^1\d{10}$/.test(targetPhone)) throw Error('请输入已验证的11位手机号');
  const matches = (await db.collection('users').where({ phone: targetPhone, phoneVerified: true }).limit(2).get()).data;
  if (matches.length !== 1) throw Error('未找到唯一的已验证微信账号，请对方先打开小程序并授权手机号');
  return { openid: matches[0]._id, name: matches[0].name || '未设置昵称', phone: targetPhone };
}
async function adminSetMember(openid, target, enabled) {
  await requireAccountManager(openid);
  const targetId = cleanText(target, '账号标识', 100, true);
  if (targetId === openid) throw Error('不能修改自己的管理员账号');
  if (enabled) {
    const user = await getDoc('users', targetId);
    if (!user || !user.phoneVerified || !user.phone) throw Error('对方需先在小程序授权手机号');
  }
  await db.runTransaction(async tx => {
    const doc = (await tx.collection('settings').doc('main').get()).data;
    if (!accountManagerIds(doc).includes(openid)) throw Error('没有管理员账号管理权限');
    if (targetId === ownerId(doc)) throw Error('不能修改首位管理员');
    const ids = adminIds(doc).filter(id => id !== targetId);
    if (enabled) ids.push(targetId);
    const managers = enabled ? accountManagerIds(doc) : accountManagerIds(doc).filter(id => id !== targetId);
    await tx.collection('settings').doc('main').update({ data: { adminOwnerOpenid: ownerId(doc), adminOpenids: ids, adminManagerOpenids: managers, updatedAt: db.serverDate() } });
  });
  return true;
}
async function adminSetAccountManager(openid, target, enabled) {
  await requireAccountManager(openid);
  const targetId = cleanText(target, '账号标识', 100, true);
  if (targetId === openid) throw Error('不能修改自己的账号管理权限');
  await db.runTransaction(async tx => {
    const doc = (await tx.collection('settings').doc('main').get()).data;
    if (!accountManagerIds(doc).includes(openid)) throw Error('没有管理员账号管理权限');
    if (targetId === ownerId(doc)) throw Error('不能修改首位管理员');
    if (!adminIds(doc).includes(targetId)) throw Error('请先添加为管理员');
    const managers = accountManagerIds(doc).filter(id => id !== targetId);
    if (enabled) managers.push(targetId);
    await tx.collection('settings').doc('main').update({ data: { adminManagerOpenids: managers, updatedAt: db.serverDate() } });
  });
  return true;
}
function cleanText(value, label, max, required = false) {
  const s = String(value || '').trim();
  if ((required && !s) || s.length > max) throw Error(`${label}格式不正确`);
  return s;
}
function cleanImages(items, max = 12) {
  if (!Array.isArray(items) || items.length > max) throw Error('图片数量超出限制');
  return items.map(x => cleanText(x, '图片地址', 500, true));
}
function cleanExhibition(raw) {
  const title = cleanText(raw.title, '展览名称', 100, true);
  const description = cleanText(raw.description, '展览介绍', 5000);
  const startDate = cleanText(raw.startDate, '开始日期', 10, true);
  const endDate = cleanText(raw.endDate, '结束日期', 10, true);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw Error('展览日期不正确');
  if (!Array.isArray(raw.dailySlots) || raw.dailySlots.length > 24) throw Error('预约时段不正确');
  const times = new Set();
  const dailySlots = raw.dailySlots.map(x => {
    const time = cleanText(x.time, '时段', 5, true);
    const capacity = Number(x.capacity);
    if (!/^([01]\d|2[0-3]):00$/.test(time) || times.has(time) || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw Error('每个时段须为整点开始，人数须为正整数');
    times.add(time);
    return { time, capacity };
  }).sort((a, b) => a.time.localeCompare(b.time));
  return { title, description, startDate, endDate, dailySlots, coverImage: cleanText(raw.coverImage, '封面图片', 500), galleryImages: cleanImages(raw.galleryImages || []), published: raw.published === true, updatedAt: db.serverDate() };
}
async function allCollection(name, query) {
  const out = [];
  for (let skip = 0; ; skip += 100) {
    const collection = db.collection(name);
    const page = (await (Object.keys(query).length ? collection.where(query) : collection).skip(skip).limit(100).get()).data;
    out.push(...page);
    if (page.length < 100) return out;
  }
}
async function bookingsWithCurrentExhibitionTitles(bookings) {
  const ids = [...new Set(bookings.map(x => x.exhibitionId).filter(Boolean))];
  const titles = new Map();
  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = await Promise.all(ids.slice(offset, offset + 10).map(id => getDoc('exhibitions', id)));
    batch.forEach((exhibit, index) => { if (exhibit && exhibit.title) titles.set(ids[offset + index], exhibit.title); });
  }
  return bookings.map(booking => ({ ...booking, exhibitionTitle: titles.get(booking.exhibitionId) || booking.exhibitionTitle }));
}
async function adminSaveExhibition(event) {
  const raw = event.exhibition || {};
  const data = cleanExhibition(raw);
  const id = cleanText(raw._id || event.id, '展览编号', 100);
  if (id) {
    const old = await getDoc('exhibitions', id);
    if (!old) throw Error('展览不存在');
    if (old.archived) throw Error('展览已归档，不能修改');
    const occupied = await allCollection('slots', { exhibitionId: id });
    for (const slot of occupied.filter(x => x.reserved > 0)) {
      const time = data.dailySlots.find(x => x.time === slot.time);
      if (slot.date < data.startDate || slot.date > data.endDate || !time) throw Error('已有预约的日期或时段不能移除');
      if (slot.reserved > time.capacity) throw Error('时段人数不能小于已预约人数');
    }
    await db.collection('exhibitions').doc(id).update({ data });
    return id;
  }
  const result = await db.collection('exhibitions').add({ data: { ...data, createdAt: db.serverDate() } });
  return result._id;
}
async function adminDeleteExhibition(id) {
  if (!id) throw Error('缺少展览编号');
  const exhibit = await getDoc('exhibitions', id);
  if (!exhibit) throw Error('展览不存在');
  if (exhibit.archived) return { cancelledCount: 0 };
  await db.collection('exhibitions').doc(id).update({ data: { published: false, updatedAt: db.serverDate() } });
  const active = await allCollection('bookings', { exhibitionId: id, status: 'active' });
  let cancelledCount = 0;
  for (const booking of active) {
    const startsAt = Date.parse(`${booking.date}T${booking.time}:00+08:00`);
    if (startsAt > Date.now()) {
      try { await adminCancelBooking(booking._id, 'exhibition_archive'); cancelledCount++; }
      catch (error) {
        const current = await getDoc('bookings', booking._id);
        if (!current || current.status === 'active') throw Error(`展览已下架，但有预约未取消：${error.message}`);
      }
    }
  }
  await db.collection('exhibitions').doc(id).update({ data: { archived: true, archivedAt: db.serverDate(), updatedAt: db.serverDate() } });
  return { cancelledCount };
}
async function adminSaveSettings(event) {
  const raw = event.settings || {};
  const advanceDays = Number(raw.advanceDays);
  const people = Number(raw.maxPeople);
  if (!Number.isInteger(advanceDays) || advanceDays < 0 || advanceDays > 365) throw Error('提前预约天数应为0至365');
  if (!Number.isInteger(people) || people < 1 || people > 100) throw Error('每次预约人数应为1至100');
  const data = {
    advanceDays, maxPeople: people,
    contactName: cleanText(raw.contactName, '馆名', 100),
    contactPhone: cleanText(raw.contactPhone, '联系电话', 40),
    contactAddress: cleanText(raw.contactAddress, '联系地址', 300),
    openingHours: cleanText(raw.openingHours, '开放时间', 300),
    bannerImages: cleanImages(raw.bannerImages || [], 8), updatedAt: db.serverDate()
  };
  if (await getDoc('settings', 'main')) await db.collection('settings').doc('main').update({ data });
  else await db.collection('settings').add({ data: { _id: 'main', ...data } });
  return data;
}
async function adminCreateBooking(event) {
  const exhibit = await getDoc('exhibitions', event.exhibitionId);
  if (!exhibit || !exhibit.published) throw Error('展览不存在或未发布');
  const slot = slotInfo(exhibit, event.date, event.time);
  const config = await settings();
  if (event.date < tomorrowOffset(nonnegativeDays(config.advanceDays))) throw Error('请至少提前预约');
  const people = Number(event.people);
  if (!Number.isInteger(people) || people < 1 || people > maxPeople(config.maxPeople)) throw Error(`每次最多预约${maxPeople(config.maxPeople)}人`);
  const name = cleanText(event.name, '客人姓名', 40, true);
  const phone = cleanText(event.phone, '客人手机号', 30, true);
  if (!/^\+?\d[\d -]{5,25}$/.test(phone)) throw Error('手机号格式不正确');
  if ((await db.collection('bookings').where({ exhibitionId: exhibit._id, date: event.date, phone, status: 'active' }).limit(1).get()).data.length) throw Error('该手机号在此展览当天已预约');
  const guardId = phoneGuard(phone, exhibit._id, event.date);
  const slotId = `${exhibit._id}_${event.date}_${event.time.replace(':', '')}`;
  const bookingId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await db.runTransaction(async tx => {
    const currentExhibit = await tx.collection('exhibitions').doc(exhibit._id).get();
    if (!currentExhibit.data || !currentExhibit.data.published || currentExhibit.data.archived) throw Error('展览已下架');
    const guard = await tx.collection('bookingGuards').doc(guardId).get().catch(() => null);
    if (guard && guard.data) throw Error('该手机号在此展览当天已预约');
    const booked = await tx.collection('slots').doc(slotId).get().catch(() => null);
    const count = booked && booked.data ? booked.data.reserved : 0;
    if (count + people > slot.capacity) throw Error('该时段名额不足');
    if (booked && booked.data) await tx.collection('slots').doc(slotId).update({ data: { reserved: count + people } });
    else await tx.collection('slots').add({ data: { _id: slotId, exhibitionId: exhibit._id, date: event.date, time: event.time, reserved: people } });
    await tx.collection('bookingGuards').add({ data: { _id: guardId, bookingId } });
    await tx.collection('bookings').add({ data: { _id: bookingId, openid: '', source: 'admin', exhibitionId: exhibit._id, exhibitionTitle: exhibit.title, date: event.date, time: event.time, people, name, phone, status: 'active', createdAt: db.serverDate(), updatedAt: db.serverDate() } });
  });
  return { bookingId };
}
async function adminCancelBooking(id, actor) {
  await db.runTransaction(async tx => {
    const result = await tx.collection('bookings').doc(id).get();
    const b = result.data;
    if (!b || b.status !== 'active') throw Error('预约不存在或已经取消');
    const slotId = `${b.exhibitionId}_${b.date}_${b.time.replace(':', '')}`;
    const slot = await tx.collection('slots').doc(slotId).get();
    await tx.collection('slots').doc(slotId).update({ data: { reserved: Math.max(0, slot.data.reserved - b.people) } });
    const pId = phoneGuard(b.phone, b.exhibitionId, b.date);
    const p = await tx.collection('bookingGuards').doc(pId).get().catch(() => null);
    if (p && p.data && p.data.bookingId === id) await tx.collection('bookingGuards').doc(pId).remove();
    if (b.openid) {
      const gId = `${b.openid}_${b.exhibitionId}_${b.date}`;
      const g = await tx.collection('bookingGuards').doc(gId).get().catch(() => null);
      if (g && g.data && g.data.bookingId === id) await tx.collection('bookingGuards').doc(gId).remove();
    }
    await tx.collection('bookings').doc(id).update({ data: { status: 'cancelled', cancelledBy: actor, updatedAt: db.serverDate() } });
  });
  return true;
}
async function adminUpdateBooking(event) {
  const id = cleanText(event.id, '预约编号', 150, true);
  const old = await getDoc('bookings', id);
  if (!old || old.status !== 'active') throw Error('预约不存在或已经取消');
  const exhibit = await getDoc('exhibitions', old.exhibitionId);
  if (!exhibit || !exhibit.published) throw Error('展览已下架，不能修改预约');
  const date = cleanText(event.date, '预约日期', 10, true);
  const time = cleanText(event.time, '预约时间', 5, true);
  const slot = slotInfo(exhibit, date, time);
  const config = await settings();
  if (date < tomorrowOffset(nonnegativeDays(config.advanceDays))) throw Error('请至少提前预约');
  const people = Number(event.people);
  if (!Number.isInteger(people) || people < 1 || people > maxPeople(config.maxPeople)) throw Error(`每次最多预约${maxPeople(config.maxPeople)}人`);
  const name = cleanText(event.name, '客人姓名', 40, true);
  const phone = cleanText(event.phone, '客人手机号', 30, true);
  if (!/^\+?\d[\d -]{5,25}$/.test(phone)) throw Error('手机号格式不正确');
  if (old.openid && phone !== old.phone) throw Error('微信用户手机号须由用户本人授权修改');
  const existing = (await db.collection('bookings').where({ exhibitionId: old.exhibitionId, date, phone, status: 'active' }).limit(2).get()).data;
  if (existing.some(x => x._id !== id)) throw Error('该手机号在此展览当天已预约');
  const oldSlotId = `${old.exhibitionId}_${old.date}_${old.time.replace(':', '')}`;
  const newSlotId = `${old.exhibitionId}_${date}_${time.replace(':', '')}`;
  const oldPhoneId = phoneGuard(old.phone, old.exhibitionId, old.date);
  const newPhoneId = phoneGuard(phone, old.exhibitionId, date);
  const oldUserId = old.openid ? `${old.openid}_${old.exhibitionId}_${old.date}` : '';
  const newUserId = old.openid ? `${old.openid}_${old.exhibitionId}_${date}` : '';
  await db.runTransaction(async tx => {
    const currentExhibit = await tx.collection('exhibitions').doc(old.exhibitionId).get();
    if (!currentExhibit.data || !currentExhibit.data.published || currentExhibit.data.archived) throw Error('展览已下架');
    const current = (await tx.collection('bookings').doc(id).get()).data;
    if (!current || current.status !== 'active' || current.date !== old.date || current.time !== old.time || current.people !== old.people) throw Error('预约已变更，请刷新后重试');
    const oldSlot = (await tx.collection('slots').doc(oldSlotId).get()).data;
    const newSlot = oldSlotId === newSlotId ? { data: oldSlot } : await tx.collection('slots').doc(newSlotId).get().catch(() => null);
    const newCount = newSlot && newSlot.data ? newSlot.data.reserved : 0;
    if (newCount + people - (oldSlotId === newSlotId ? old.people : 0) > slot.capacity) throw Error('该时段名额不足');
    const oldPhoneGuard = await tx.collection('bookingGuards').doc(oldPhoneId).get().catch(() => null);
    const newPhoneGuard = oldPhoneId === newPhoneId ? oldPhoneGuard : await tx.collection('bookingGuards').doc(newPhoneId).get().catch(() => null);
    if (newPhoneGuard && newPhoneGuard.data && newPhoneGuard.data.bookingId !== id) throw Error('该手机号在此展览当天已预约');
    const oldUserGuard = oldUserId ? await tx.collection('bookingGuards').doc(oldUserId).get().catch(() => null) : null;
    const newUserGuard = newUserId === oldUserId ? oldUserGuard : newUserId ? await tx.collection('bookingGuards').doc(newUserId).get().catch(() => null) : null;
    if (newUserGuard && newUserGuard.data && newUserGuard.data.bookingId !== id) throw Error('该展览当天已预约');
    if (oldSlotId === newSlotId) await tx.collection('slots').doc(oldSlotId).update({ data: { reserved: newCount + people - old.people } });
    else {
      await tx.collection('slots').doc(oldSlotId).update({ data: { reserved: Math.max(0, oldSlot.reserved - old.people) } });
      if (newSlot && newSlot.data) await tx.collection('slots').doc(newSlotId).update({ data: { reserved: newCount + people } });
      else await tx.collection('slots').add({ data: { _id: newSlotId, exhibitionId: old.exhibitionId, date, time, reserved: people } });
    }
    if (oldPhoneId !== newPhoneId && oldPhoneGuard && oldPhoneGuard.data && oldPhoneGuard.data.bookingId === id) await tx.collection('bookingGuards').doc(oldPhoneId).remove();
    if (!newPhoneGuard || !newPhoneGuard.data) await tx.collection('bookingGuards').add({ data: { _id: newPhoneId, bookingId: id } });
    if (oldUserId !== newUserId && oldUserGuard && oldUserGuard.data && oldUserGuard.data.bookingId === id) await tx.collection('bookingGuards').doc(oldUserId).remove();
    if (newUserId && (!newUserGuard || !newUserGuard.data)) await tx.collection('bookingGuards').add({ data: { _id: newUserId, bookingId: id } });
    await tx.collection('bookings').doc(id).update({ data: { date, time, people, name, phone, updatedAt: db.serverDate() } });
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
      case 'myBookings': data = await bookingsWithCurrentExhibitionTitles((await db.collection('bookings').where({ openid }).orderBy('createdAt', 'desc').limit(100).get()).data); break;
      case 'cancel': data = await cancel(openid, event.id); break;
      case 'adminStatus': { const config = await getDoc('settings', 'main'); data = { openid, isAdmin: adminIds(config).includes(openid), isOwner: ownerId(config) === openid, canManageAdmins: accountManagerIds(config).includes(openid) }; break; }
      case 'adminMembers': data = await adminMembers(openid); break;
      case 'adminLookupUser': data = await adminLookupUser(openid, event.phone); break;
      case 'adminSetMember': data = await adminSetMember(openid, event.openid, event.enabled === true); break;
      case 'adminSetAccountManager': data = await adminSetAccountManager(openid, event.openid, event.enabled === true); break;
      case 'adminExhibitions': await requireAdmin(openid); data = (await allCollection('exhibitions', {})).filter(x => !x.archived).map(x => ({ ...x, phase: phase(x) })).sort((a, b) => b.startDate.localeCompare(a.startDate)); break;
      case 'adminSaveExhibition': await requireAdmin(openid); data = await adminSaveExhibition(event); break;
      case 'adminDeleteExhibition': await requireAdmin(openid); data = await adminDeleteExhibition(event.id); break;
      case 'adminSettings': await requireAdmin(openid); data = await settings(); break;
      case 'adminSaveSettings': await requireAdmin(openid); data = await adminSaveSettings(event); break;
      case 'adminBookings': await requireAdmin(openid); data = (await bookingsWithCurrentExhibitionTitles(await allCollection('bookings', {}))).sort((a, b) => (b.date || '').localeCompare(a.date || '')); break;
      case 'adminCreateBooking': await requireAdmin(openid); data = await adminCreateBooking(event); break;
      case 'adminCancelBooking': await requireAdmin(openid); data = await adminCancelBooking(event.id, openid); break;
      case 'adminUpdateBooking': await requireAdmin(openid); data = await adminUpdateBooking(event); break;
      default: throw Error('未知操作');
    }
    return { ok: true, data };
  } catch (e) { console.error(e); return { ok: false, error: e.message || '服务暂不可用' }; }
};
