const { call, message } = require('../../utils/api');
Page({
  data: { profile: {}, avatarInitial: '艺' },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 3 }); call('profile').then(profile => this.setData({ profile, avatarInitial: profile.name ? profile.name[0] : '艺' })).catch(message); },
  profile() { wx.navigateTo({ url: '/pages/profile/index' }); },
  bookings() { wx.navigateTo({ url: '/pages/my-bookings/index' }); }
});
