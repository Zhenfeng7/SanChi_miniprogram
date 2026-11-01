const { call, message } = require('../../utils/api');
Page({
  data: { exhibitions: [], activeBookings: 0, loading: true, error: '' },
  onShow() { this.load(); },
  async load() {
    try {
      const [exhibitions, bookings] = await Promise.all([call('adminExhibitions'), call('adminBookings')]);
      this.setData({ exhibitions, activeBookings: bookings.filter(x => x.status === 'active').length, loading: false, error: '' });
    } catch (e) { this.setData({ loading: false, error: e.message || '加载失败' }); message(e); }
  },
  newExhibition() { wx.navigateTo({ url: '/pages/admin-exhibition/index' }); },
  editExhibition(e) { wx.navigateTo({ url: `/pages/admin-exhibition/index?id=${e.currentTarget.dataset.id}` }); },
  bookings() { wx.navigateTo({ url: '/pages/admin-bookings/index' }); },
  settings() { wx.navigateTo({ url: '/pages/admin-settings/index' }); }
});
