const { call, message } = require('../../utils/api');
Page({
  data: { profile: {}, avatarInitial: '艺', isAdmin: false },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 3 }); call('profile').then(profile => this.setData({ profile, avatarInitial: profile.name ? profile.name[0] : '艺' })).catch(message); call('adminStatus').then(status => this.setData({ isAdmin: status.isAdmin })).catch(() => this.setData({ isAdmin: false })); },
  profile() { wx.navigateTo({ url: '/pages/profile/index' }); },
  bookings() { wx.navigateTo({ url: '/pages/my-bookings/index' }); },
  admin() { wx.navigateTo({ url: '/pages/admin/index' }); }
});
