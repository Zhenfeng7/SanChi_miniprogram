const { call, message } = require('../../utils/api');
const config = require('../../config');
const { withImages } = require('../../utils/exhibition-images');
const { imageUrls } = require('../../utils/cloud-images');
const defaultBanners = ['/images/banners/sanchi-00.jpg', '/images/banners/sanchi-01.jpg', '/images/banners/sanchi-02.jpg', '/images/banners/sanchi-03.jpg'];
Page({
  data: {
    current: [], past: [],
    banners: defaultBanners,
    settings: {}, loading: true, error: '', demoMode: config.demoMode
  },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 0 }); this.load(); },
  async load() {
    try {
      const data = await call('home');
      const exhibitions = data.exhibitions.map(withImages);
      const savedBanners = data.settings.bannerImages || [];
      const image = await imageUrls([...savedBanners, ...exhibitions.flatMap(x => [x.coverImage, ...x.galleryImages])]);
      const display = x => ({ ...x, coverImage: image(x.coverImage), galleryImages: x.galleryImages.map(image).filter(Boolean) });
      const banners = savedBanners.map(image).filter(Boolean);
      this.setData({ current: exhibitions.filter(x => x.phase !== 'past').map(display), past: exhibitions.filter(x => x.phase === 'past').map(display), banners: banners.length ? banners : defaultBanners, settings: data.settings, loading: false, error: '' });
    } catch (e) { this.setData({ loading: false, error: e.message || '数据加载失败' }); message(e); }
  },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); },
  booking() { wx.switchTab({ url: '/pages/booking/index' }); },
  phone() { if (this.data.settings.contactPhone) wx.makePhoneCall({ phoneNumber: this.data.settings.contactPhone }); }
});
