const { call, message } = require('../../utils/api');
Page({
  data: { name: '', phone: '', phoneVerified: false, saving: false },
  onLoad() { call('profile').then(x => this.setData({ name: x.name, phone: x.phone, phoneVerified: x.phoneVerified })).catch(message); },
  name(e) { this.setData({ name: e.detail.value }); },
  async wechatPhone(e) {
    if (!e.detail.code) { wx.showToast({ title: '未授权手机号', icon: 'none' }); return; }
    try { const x = await call('wechatPhone', { code: e.detail.code }); this.setData({ phone: x.phone, phoneVerified: x.phoneVerified }); wx.showToast({ title: '手机号已授权' }); } catch (err) { message(err); }
  },
  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try { await call('saveProfile', { name: this.data.name }); wx.showToast({ title: '已保存' }); setTimeout(() => wx.navigateBack(), 600); }
    catch (e) { message(e); }
    finally { this.setData({ saving: false }); }
  }
});
