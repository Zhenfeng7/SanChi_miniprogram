const { call, message } = require('../../utils/api');
const config = require('../../config');
const { withImages } = require('../../utils/exhibition-images');
Page({
  data: {
    current: [], past: [],
    banners: ['/images/banners/sanchi-00.jpg', '/images/banners/sanchi-01.jpg', '/images/banners/sanchi-02.jpg', '/images/banners/sanchi-03.jpg'],
    settings: {}, loading: true, error: '', demoMode: config.demoMode
  },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 0 }); this.load(); },
  async load() {
    try {
      const data = await call('home');
      this.setData({ current: data.exhibitions.filter(x => x.phase !== 'past').map(withImages), past: data.exhibitions.filter(x => x.phase === 'past').map(withImages), settings: data.settings, loading: false, error: '' });
    } catch (e) { this.setData({ loading: false, error: e.message || '数据加载失败' }); message(e); }
  },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); },
  booking() { wx.switchTab({ url: '/pages/booking/index' }); },
  phone() { if (this.data.settings.contactPhone) wx.makePhoneCall({ phoneNumber: this.data.settings.contactPhone }); }
});
