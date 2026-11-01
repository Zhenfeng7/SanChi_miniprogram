const { call, message } = require('../../utils/api');
const { chooseAndUpload } = require('../../utils/admin-image');
const { DEFAULT_START, DEFAULT_END, DEFAULT_CAPACITY, hourLabel, buildSlots, scheduleFromSlots } = require('../../utils/booking-hours');
function today() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
const startOptions = Array.from({ length: 24 }, (_, hour) => hourLabel(hour));
const endOptions = Array.from({ length: 24 }, (_, hour) => hourLabel(hour + 1));
Page({
  data: { id: '', saving: false, uploading: false, startOptions, endOptions, schedule: { start: DEFAULT_START, end: DEFAULT_END, capacity: DEFAULT_CAPACITY, irregular: false }, scheduleChanged: true, form: { title: '', description: '', startDate: today(), endDate: today(), coverImage: '', galleryImages: [], dailySlots: buildSlots(DEFAULT_START, DEFAULT_END, DEFAULT_CAPACITY), published: false } },
  onLoad(options) { if (options.id) { this.setData({ id: options.id }); this.load(options.id); } },
  async load(id) {
    try { const items = await call('adminExhibitions'); const item = items.find(x => x._id === id); if (!item) throw Error('展览不存在'); const slots = item.dailySlots || []; this.setData({ schedule: scheduleFromSlots(slots), scheduleChanged: false, form: { title: item.title || '', description: item.description || '', startDate: item.startDate, endDate: item.endDate, coverImage: item.coverImage || '', galleryImages: item.galleryImages || [], dailySlots: slots, published: item.published === true } }); }
    catch (e) { message(e); }
  },
  text(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  date(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  published(e) { this.setData({ 'form.published': e.detail.value }); },
  scheduleHour(e) { this.setData({ [`schedule.${e.currentTarget.dataset.field}`]: Number(e.detail.value) + (e.currentTarget.dataset.field === 'end' ? 1 : 0), scheduleChanged: true }); this.refreshSchedule(); },
  scheduleCapacity(e) { this.setData({ 'schedule.capacity': e.detail.value, scheduleChanged: true }); this.refreshSchedule(); },
  refreshSchedule() { const { start, end, capacity } = this.data.schedule; try { this.setData({ 'form.dailySlots': buildSlots(start, end, capacity), 'schedule.irregular': false }); } catch (_) { this.setData({ 'form.dailySlots': [] }); } },
  async cover() { await this.upload('cover'); },
  async gallery() { await this.upload('gallery'); },
  async upload(kind) {
    if (this.data.uploading) return;
    if (kind === 'gallery' && this.data.form.galleryImages.length >= 12) { wx.showToast({ title: '最多添加12张', icon: 'none' }); return; }
    this.setData({ uploading: true });
    try {
      const files = await chooseAndUpload('exhibitions', kind === 'cover' ? 1 : Math.min(9, 12 - this.data.form.galleryImages.length));
      if (kind === 'cover') this.setData({ 'form.coverImage': files[0] });
      else this.setData({ 'form.galleryImages': [...this.data.form.galleryImages, ...files] });
    } catch (e) { if (!/cancel/i.test(e.errMsg || '')) message(e); }
    finally { this.setData({ uploading: false }); }
  },
  removeCover() { this.setData({ 'form.coverImage': '' }); },
  removeImage(e) { const images = [...this.data.form.galleryImages]; images.splice(e.currentTarget.dataset.index, 1); this.setData({ 'form.galleryImages': images }); },
  async save() {
    if (this.data.saving) return;
    if (this.data.scheduleChanged && !this.data.form.dailySlots.length) { wx.showToast({ title: '请检查预约时间和人数', icon: 'none' }); return; }
    this.setData({ saving: true });
    try { await call('adminSaveExhibition', { id: this.data.id, exhibition: { ...this.data.form, _id: this.data.id } }); wx.showToast({ title: '展览已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 800); }
    catch (e) { message(e); }
    finally { this.setData({ saving: false }); }
  },
  remove() {
    wx.showModal({ title: '删除展览', content: '删除后无法恢复。有有效预约时不能删除，可先关闭“发布展览”。', success: async result => { if (!result.confirm) return; try { await call('adminDeleteExhibition', { id: this.data.id }); wx.showToast({ title: '已删除' }); wx.navigateBack(); } catch (e) { message(e); } } });
  }
});
