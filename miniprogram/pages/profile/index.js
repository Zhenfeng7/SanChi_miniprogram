const { call, message } = require('../../utils/api');
Page({
  data: { name: '', phone: '', saving: false },
  onLoad() { call('profile').then(x => this.setData({ name: x.name, phone: x.phone })).catch(message); },
  name(e) { this.setData({ name: e.detail.value }); },
  phone(e) { this.setData({ phone: e.detail.value }); },
  async wechatPhone(e) {
    if (!e.detail.code) return;
    try { const x = await call('wechatPhone', { code: e.detail.code }); this.setData({ phone: x.phone }); } catch (err) { message(err); }
  },
  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try { await call('saveProfile', { name: this.data.name, phone: this.data.phone }); wx.showToast({ title: '已保存' }); setTimeout(() => wx.navigateBack(), 600); }
    catch (e) { message(e); }
    finally { this.setData({ saving: false }); }
  }
});
