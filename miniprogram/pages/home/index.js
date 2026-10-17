const { call, message } = require('../../utils/api');
Page({
  data: { current: [], past: [], banners: [1, 2, 3], settings: {}, loading: true },
  onShow() { this.load(); },
  async load() {
    try {
      const data = await call('home');
      this.setData({ current: data.exhibitions.filter(x => x.phase !== 'past'), past: data.exhibitions.filter(x => x.phase === 'past'), settings: data.settings, loading: false });
    } catch (e) { this.setData({ loading: false }); message(e); }
  },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); },
  booking() { wx.switchTab({ url: '/pages/booking/index' }); },
  phone() { if (this.data.settings.contactPhone) wx.makePhoneCall({ phoneNumber: this.data.settings.contactPhone }); }
});
