const { call, message } = require('../../utils/api');
const { chooseAndUpload } = require('../../utils/admin-image');
function today() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
const hourOptions = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
Page({
  data: { id: '', saving: false, uploading: false, hourOptions, form: { title: '', description: '', startDate: today(), endDate: today(), coverImage: '', galleryImages: [], dailySlots: [{ time: '10:00', capacity: 12 }], published: false } },
  onLoad(options) { if (options.id) { this.setData({ id: options.id }); this.load(options.id); } },
  async load(id) {
    try { const items = await call('adminExhibitions'); const item = items.find(x => x._id === id); if (!item) throw Error('展览不存在'); this.setData({ form: { title: item.title || '', description: item.description || '', startDate: item.startDate, endDate: item.endDate, coverImage: item.coverImage || '', galleryImages: item.galleryImages || [], dailySlots: item.dailySlots || [], published: item.published === true } }); }
    catch (e) { message(e); }
  },
  text(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  date(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  published(e) { this.setData({ 'form.published': e.detail.value }); },
  slotTime(e) { this.setData({ [`form.dailySlots[${e.currentTarget.dataset.index}].time`]: hourOptions[Number(e.detail.value)] }); },
  slotCapacity(e) { this.setData({ [`form.dailySlots[${e.currentTarget.dataset.index}].capacity`]: e.detail.value }); },
  addSlot() { const used = this.data.form.dailySlots.map(x => x.time); const time = hourOptions.find(x => !used.includes(x)); if (!time) { wx.showToast({ title: '已添加全部时段', icon: 'none' }); return; } this.setData({ 'form.dailySlots': [...this.data.form.dailySlots, { time, capacity: 12 }] }); },
  removeSlot(e) { const slots = [...this.data.form.dailySlots]; slots.splice(e.currentTarget.dataset.index, 1); this.setData({ 'form.dailySlots': slots }); },
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
    this.setData({ saving: true });
    try { await call('adminSaveExhibition', { id: this.data.id, exhibition: { ...this.data.form, _id: this.data.id } }); wx.showToast({ title: '展览已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 800); }
    catch (e) { message(e); }
    finally { this.setData({ saving: false }); }
  },
  remove() {
    wx.showModal({ title: '删除展览', content: '删除后无法恢复。有有效预约时不能删除，可先关闭“发布展览”。', success: async result => { if (!result.confirm) return; try { await call('adminDeleteExhibition', { id: this.data.id }); wx.showToast({ title: '已删除' }); wx.navigateBack(); } catch (e) { message(e); } } });
  }
});
