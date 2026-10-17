const { call, message } = require('../../utils/api');
const chinaToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
Page({
  data: { exhibit: null, config: {}, date: '', minDate: '', dates: [], slots: [], people: 1, peopleOptions: [1, 2, 3, 4], time: '', past: false, canBook: false, busy: false },
  onLoad(options) { this.id = options.id; this.load(); },
  async load() {
    try {
      const [exhibit, config] = await Promise.all([call('exhibition', { id: this.id }), call('settings')]);
      const today = chinaToday();
      const advanceDays = Number.isInteger(Number(config.advanceDays)) && Number(config.advanceDays) >= 0 ? Number(config.advanceDays) : 1;
      const peopleLimit = Number.isInteger(Number(config.maxPeople)) && Number(config.maxPeople) >= 1 ? Number(config.maxPeople) : 4;
      const minDate = addDays(today, advanceDays);
      const past = exhibit.endDate < today;
      const date = exhibit.startDate > minDate ? exhibit.startDate : minDate;
      const dates = [];
      for (let i = 0; i < 14 && addDays(date, i) <= exhibit.endDate; i++) dates.push({ value: addDays(date, i), day: addDays(date, i).slice(8), weekday: '日一二三四五六'[new Date(`${addDays(date, i)}T00:00:00Z`).getUTCDay()] });
      this.setData({ exhibit, config, minDate, date: past ? '' : date, dates, past, canBook: !past && date <= exhibit.endDate, peopleOptions: Array.from({ length: peopleLimit }, (_, i) => i + 1) });
      if (!past && date <= exhibit.endDate) this.loadSlots();
    } catch (e) { message(e); }
  },
  async loadSlots() {
    try { const slots = await call('availability', { exhibitionId: this.id, date: this.data.date }); this.setData({ slots, time: '' }); }
    catch (e) { message(e); }
  },
  chooseDate(e) { this.setData({ date: e.currentTarget.dataset.date }); this.loadSlots(); },
  pickDate(e) { this.setData({ date: e.detail.value }); this.loadSlots(); },
  choosePeople(e) { this.setData({ people: Number(e.currentTarget.dataset.people), time: '' }); },
  chooseTime(e) { const x = this.data.slots.find(s => s.time === e.currentTarget.dataset.time); if (x && x.remaining >= this.data.people) this.setData({ time: x.time }); },
  async reserve() {
    if (this.data.busy || !this.data.time) return;
    this.setData({ busy: true });
    try {
      const profile = await call('profile');
      if (!profile.name || !profile.phone) {
        wx.showModal({ title: '完善预约信息', content: '预约前需填写姓名和手机号。', success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/profile/index' }); } });
        return;
      }
      await call('reserve', { exhibitionId: this.id, date: this.data.date, time: this.data.time, people: this.data.people });
      wx.showModal({ title: '预约成功', content: '可在「我的预约」查看详情。', showCancel: false, success: () => wx.navigateTo({ url: '/pages/my-bookings/index' }) });
      this.loadSlots();
    } catch (e) { message(e); this.loadSlots(); }
    finally { this.setData({ busy: false }); }
  }
});
