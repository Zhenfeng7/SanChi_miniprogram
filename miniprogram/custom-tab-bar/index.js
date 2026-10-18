Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: '/pages/home/index', text: '主页', icon: '/images/icons/home.png', activeIcon: '/images/icons/home-active.png' },
      { pagePath: '/pages/booking/index', text: '预约', icon: '/images/icons/business.png', activeIcon: '/images/icons/business-active.png' },
      { pagePath: '/pages/shop/index', text: '商城', icon: '/images/icons/goods.png', activeIcon: '/images/icons/goods-active.png' },
      { pagePath: '/pages/me/index', text: '我的', icon: '/images/icons/usercenter.png', activeIcon: '/images/icons/usercenter-active.png' }
    ]
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (index === this.data.selected) return;
      wx.switchTab({ url: this.data.tabs[index].pagePath });
    }
  }
});
