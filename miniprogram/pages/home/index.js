const { call, message } = require('../../utils/api');
const config = require('../../config');
Page({
  data: { current: [], past: [], banners: [1, 2, 3], settings: {}, loading: true, error: '', demoMode: config.demoMode },
  onShow() { this.load(); },
  async load() {
    try {
      const data = await call('home');
      this.setData({ current: data.exhibitions.filter(x => x.phase !== 'past'), past: data.exhibitions.filter(x => x.phase === 'past'), settings: data.settings, loading: false, error: '' });
    } catch (e) { this.setData({ loading: false, error: e.message || '数据加载失败' }); message(e); }
  },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); },
  booking() { wx.switchTab({ url: '/pages/booking/index' }); },
  phone() { if (this.data.settings.contactPhone) wx.makePhoneCall({ phoneNumber: this.data.settings.contactPhone }); }
});
