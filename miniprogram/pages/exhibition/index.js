const { call, message } = require('../../utils/api');
const chinaToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function dateOptions(selected, minDate, endDate) {
  let start = addDays(selected, -6);
  if (start < minDate) start = minDate;
  const lastStart = addDays(endDate, -13);
  if (start > lastStart) start = lastStart < minDate ? minDate : lastStart;
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const value = addDays(start, i);
    if (value > endDate) break;
    dates.push({ value, day: value.slice(8), weekday: '日一二三四五六'[new Date(`${value}T00:00:00Z`).getUTCDay()] });
  }
  return dates;
}
Page({
  data: { exhibit: null, config: {}, date: '', minDate: '', dates: [], slots: [], slotsLoading: false, people: 1, peopleOptions: [1, 2, 3, 4], time: '', past: false, canBook: false, busy: false },
  onLoad(options) { this.id = options.id; this.load(); },
  async load() {
    try {
      const exhibit = await call('exhibition', { id: this.id });
      const config = await call('settings');
      const today = chinaToday();
      const advanceDays = Number.isInteger(Number(config.advanceDays)) && Number(config.advanceDays) >= 0 ? Number(config.advanceDays) : 1;
      const peopleLimit = Number.isInteger(Number(config.maxPeople)) && Number(config.maxPeople) >= 1 ? Number(config.maxPeople) : 4;
      const earliest = addDays(today, advanceDays);
      const minDate = exhibit.startDate > earliest ? exhibit.startDate : earliest;
      const past = exhibit.endDate < today;
      const date = minDate;
      const dates = date <= exhibit.endDate ? dateOptions(date, minDate, exhibit.endDate) : [];
      this.setData({ exhibit, config, minDate, date: past ? '' : date, dates, past, canBook: !past && date <= exhibit.endDate, peopleOptions: Array.from({ length: peopleLimit }, (_, i) => i + 1) });
      if (!past && date <= exhibit.endDate) this.loadSlots();
    } catch (e) { message(e); }
  },
  async loadSlots() {
    const date = this.data.date;
    this.setData({ slotsLoading: true, slots: [], time: '' });
    try {
      const slots = await call('availability', { exhibitionId: this.id, date });
      if (this.data.date === date) this.setData({ slots: this.decorateSlots(slots, this.data.people), slotsLoading: false });
    } catch (e) { if (this.data.date === date) { this.setData({ slotsLoading: false }); message(e); } }
  },
  decorateSlots(slots, people) { return slots.map(x => ({ time: x.time, capacity: x.capacity, remaining: x.remaining, insufficient: x.remaining < people, label: x.remaining < people ? '已满或名额不足' : `剩余${x.remaining}位` })); },
  selectDate(date) {
    if (date < this.data.minDate || date > this.data.exhibit.endDate || date === this.data.date) return;
    this.setData({ date, dates: dateOptions(date, this.data.minDate, this.data.exhibit.endDate) });
    this.loadSlots();
  },
  chooseDate(e) { this.selectDate(e.currentTarget.dataset.date); },
  pickDate(e) { this.selectDate(e.detail.value); },
  choosePeople(e) { const people = Number(e.currentTarget.dataset.people); this.setData({ people, slots: this.decorateSlots(this.data.slots, people), time: '' }); },
  chooseTime(e) { const x = this.data.slots.find(s => s.time === e.currentTarget.dataset.time); if (x && x.remaining >= this.data.people) this.setData({ time: x.time }); },
  async reserve() {
    if (this.data.busy || !this.data.time) return;
    this.setData({ busy: true });
    try {
      const profile = await call('profile');
      if (!profile.name || !profile.phoneVerified) {
        wx.showModal({ title: '完善预约信息', content: '预约前需填写姓名并授权微信手机号。', success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/profile/index' }); } });
        return;
      }
      await call('reserve', { exhibitionId: this.id, date: this.data.date, time: this.data.time, people: this.data.people });
      wx.showModal({ title: '预约成功', content: '可在「我的预约」查看详情。', showCancel: false, success: () => wx.navigateTo({ url: '/pages/my-bookings/index' }) });
      this.loadSlots();
    } catch (e) { message(e); this.loadSlots(); }
    finally { this.setData({ busy: false }); }
  }
});
