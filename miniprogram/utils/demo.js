const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const add = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function sample() {
  const d = today();
  return [
    { _id: 'demo-current', title: '正在展出的作品｜内容待更新', description: '这里将展示三尺美术馆当前展览的介绍。馆方录入真实资料后会自动替换。', startDate: add(d, -7), endDate: add(d, 40), coverImage: '', published: true, phase: 'current', dailySlots: [{ time: '10:00', capacity: 12 }, { time: '11:00', capacity: 12 }, { time: '14:00', capacity: 12 }, { time: '15:00', capacity: 12 }] },
    { _id: 'demo-past', title: '过往展览｜内容待更新', description: '这里将展示已结束展览的资料，仅供浏览。', startDate: add(d, -80), endDate: add(d, -30), coverImage: '', published: true, phase: 'past', dailySlots: [] }
  ];
}
const settings = { advanceDays: 1, maxPeople: 4, contactName: '三尺美术馆', contactPhone: '', contactAddress: '地址待公布', openingHours: '开放时间待公布' };
async function call(action, data) {
  switch (action) {
    case 'home': return { exhibitions: sample(), settings };
    case 'settings': return settings;
    case 'exhibition': return sample().find(x => x._id === data.id);
    case 'availability': return sample()[0].dailySlots.map(x => ({ ...x, remaining: x.capacity }));
    case 'profile': return wx.getStorageSync('demoProfile') || { name: '', phone: '' };
    case 'saveProfile': { const p = { name: data.name.trim(), phone: data.phone.trim() }; wx.setStorageSync('demoProfile', p); return p; }
    case 'myBookings': return [];
    case 'reserve': throw Error('当前为占位演示；启用云开发后才能保存真实预约');
    case 'wechatPhone': throw Error('手机号快捷授权需启用云开发环境');
    default: throw Error('演示模式暂不支持此操作');
  }
}
module.exports = { call };
