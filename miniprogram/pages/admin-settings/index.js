const { call, message } = require('../../utils/api');
const { chooseAndUpload } = require('../../utils/admin-image');
const { imageUrls } = require('../../utils/cloud-images');
Page({
  data: { form: { contactName: '', contactPhone: '', contactAddress: '', openingHours: '', advanceDays: 1, maxPeople: 4, bannerImages: [] }, bannerPreviews: [], saving: false, uploading: false },
  onLoad() { this.load(); },
  async load() { try { const s = await call('adminSettings'); this.setData({ form: { contactName: s.contactName || '', contactPhone: s.contactPhone || '', contactAddress: s.contactAddress || '', openingHours: s.openingHours || '', advanceDays: s.advanceDays, maxPeople: s.maxPeople, bannerImages: s.bannerImages || [] } }); await this.refreshPreviews(); } catch (e) { message(e); } },
  async refreshPreviews() { const images = this.data.form.bannerImages; const image = await imageUrls(images); if (images === this.data.form.bannerImages) this.setData({ bannerPreviews: images.map(image) }); },
  change(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },
  async addBanner() {
    if (this.data.uploading) return;
    if (this.data.form.bannerImages.length >= 8) { wx.showToast({ title: '最多添加8张', icon: 'none' }); return; }
    this.setData({ uploading: true });
    try { const images = await chooseAndUpload('banners', Math.min(8 - this.data.form.bannerImages.length, 4)); this.setData({ 'form.bannerImages': [...this.data.form.bannerImages, ...images] }); await this.refreshPreviews(); }
    catch (e) { if (!/cancel/i.test(e.errMsg || '')) message(e); }
    finally { this.setData({ uploading: false }); }
  },
  removeBanner(e) { const images = [...this.data.form.bannerImages]; const previews = [...this.data.bannerPreviews]; images.splice(e.currentTarget.dataset.index, 1); previews.splice(e.currentTarget.dataset.index, 1); this.setData({ 'form.bannerImages': images, bannerPreviews: previews }); },
  moveBanner(e) { const i = e.currentTarget.dataset.index, direction = e.currentTarget.dataset.direction; const j = i + direction; const images = [...this.data.form.bannerImages]; const previews = [...this.data.bannerPreviews]; if (j < 0 || j >= images.length) return; [images[i], images[j]] = [images[j], images[i]]; [previews[i], previews[j]] = [previews[j], previews[i]]; this.setData({ 'form.bannerImages': images, bannerPreviews: previews }); },
  async save() { if (this.data.saving) return; this.setData({ saving: true }); try { await call('adminSaveSettings', { settings: this.data.form }); wx.showToast({ title: '已保存', icon: 'success' }); } catch (e) { message(e); } finally { this.setData({ saving: false }); } }
});
