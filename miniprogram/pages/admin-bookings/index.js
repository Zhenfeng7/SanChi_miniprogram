const { call, message } = require('../../utils/api');
function blank() { return { id: '', exhibitionId: '', date: '', time: '', people: 1, name: '', phone: '' }; }
Page({
  data: { bookings: [], exhibitions: [], mode: 'list', form: blank(), exhibitionName: '', phoneLocked: false, timeOptions: [], saving: false, activeOnly: true },
  onShow() { this.load(); },
  async load() {
    try {
      const [bookings, exhibitions] = await Promise.all([call('adminBookings'), call('adminExhibitions')]);
      this.setData({ bookings, exhibitions: exhibitions.filter(x => x.published && x.phase !== 'past') });
    } catch (e) { message(e); }
  },
  toggleFilter() { this.setData({ activeOnly: !this.data.activeOnly }); },
  newBooking() { this.setData({ mode: 'new', form: blank(), exhibitionName: '', phoneLocked: false, timeOptions: [] }); },
  edit(e) {
    const b = this.data.bookings.find(x => x._id === e.currentTarget.dataset.id);
    if (!b || b.status !== 'active') return;
    const exhibit = this.data.exhibitions.find(x => x._id === b.exhibitionId);
    if (!exhibit) { wx.showToast({ title: '展览已下架，无法修改', icon: 'none' }); return; }
    this.setData({ mode: 'edit', form: { id: b._id, exhibitionId: b.exhibitionId, date: b.date, time: b.time, people: b.people, name: b.name, phone: b.phone }, exhibitionName: exhibit.title, phoneLocked: !!b.openid, timeOptions: (exhibit.dailySlots || []).map(x => x.time) });
  },
  back() { this.setData({ mode: 'list' }); },
  chooseExhibition(e) { const exhibit = this.data.exhibitions[Number(e.detail.value)]; if (!exhibit) return; const timeOptions = (exhibit.dailySlots || []).map(x => x.time); this.setData({ 'form.exhibitionId': exhibit._id, 'form.time': timeOptions[0] || '', exhibitionName: exhibit.title, timeOptions }); },
  chooseTime(e) { this.setData({ 'form.time': this.data.timeOptions[Number(e.detail.value)] || '' }); },
  chooseDate(e) { this.setData({ 'form.date': e.detail.value }); },
  text(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  async save() {
    if (this.data.saving) return;
    const f = this.data.form;
    if (!f.exhibitionId || !f.date || !f.time || !f.name || !f.phone) { wx.showToast({ title: '请填完整信息', icon: 'none' }); return; }
    this.setData({ saving: true });
    try { await call(this.data.mode === 'new' ? 'adminCreateBooking' : 'adminUpdateBooking', f); wx.showToast({ title: '预约已保存', icon: 'success' }); this.setData({ mode: 'list' }); await this.load(); }
    catch (e) { message(e); }
    finally { this.setData({ saving: false }); }
  },
  cancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '取消预约', content: '取消后会立即释放该时段名额，并同步到访客的“我的预约”。', success: async result => { if (!result.confirm) return; try { await call('adminCancelBooking', { id }); wx.showToast({ title: '已取消' }); await this.load(); } catch (error) { message(error); } } });
  }
});
