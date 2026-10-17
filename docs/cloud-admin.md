# 云开发控制台内容管理

在微信开发者工具右上角打开“云开发 → 数据库”。创建以下六个集合，并将**客户端权限设置为不可读写**。小程序只调用 `gallery` 云函数，云函数用微信 OPENID 识别用户。请勿开放 `users`、`bookings` 集合的客户端直接读取权限。

## 1. 馆方设置 `settings`

创建 `_id` 为 `main` 的记录，例如：

```json
{
  "_id": "main",
  "advanceDays": 1,
  "maxPeople": 4,
  "contactName": "三尺美术馆",
  "contactPhone": "",
  "contactAddress": "",
  "openingHours": ""
}
```

`advanceDays` 为至少提前的自然日数，设为 0 可开放当日尚未开始的时段；`maxPeople` 是每次最多预约人数，默认 4。改动保存后新预约立即按新规则判断。馆方联系方式暂留空，待确认后填写。

## 2. 展览 `exhibitions`

在控制台新增记录。以下是**字段模板，不是真实展览**：

```json
{
  "title": "展览名称",
  "description": "展览介绍",
  "startDate": "2026-11-01",
  "endDate": "2026-12-31",
  "coverImage": "",
  "published": true,
  "dailySlots": [
    { "time": "10:00", "capacity": 12 },
    { "time": "11:00", "capacity": 12 }
  ]
}
```

日期采用 `YYYY-MM-DD`，时间采用 24 小时制 `HH:mm`。一个时段代表从该时间开始的 1 小时。`capacity` 是该时段可容纳的**总人数**。同一展览每天使用相同的 `dailySlots`；如需临时关闭某天或设置节假日例外，首版尚无此功能。`published: false` 可将展览从用户界面隐藏；删除前建议先确认是否存在预约记录。`coverImage` 可填云存储的 `cloud://...` 文件 ID；为空时显示占位画面。展览结束后自动进入“过往展览”，详情页不会显示预约入口。

管理员可在控制台新增、查看、编辑、删除展览记录。若已产生预约，修改 `dailySlots` 的时间或人数上限前，应先检查 `slots` 集合中对应日期时段的 `reserved`，避免新上限低于现有预约人数。

## 3. 预约与用户数据

- `bookings`：每条预约含 `exhibitionId`、`exhibitionTitle`、`date`、`time`、`people`、`name`、`phone`、`status`（`active` / `cancelled`）、`openid`、创建/更新时间。用户取消后记录保留，状态改为 `cancelled`。
- `users`：以 OPENID 为 `_id` 保存用户姓名和手机号。用户可在“我的信息”更新。
- `slots`：以展览 ID、日期、时段组成 `_id`，`reserved` 为当前已占人数。
- `bookingGuards`：以用户 OPENID、展览 ID、日期组成 `_id`，防止同一展览同日重复预约。

馆方可在控制台检索、查看预约记录。**若管理员需要代用户新增、改期、取消或删除预约，不能只编辑 `bookings`**：还需同步调整 `slots.reserved` 和 `bookingGuards`，否则可用名额或重复预约判断会失准。首版建议让用户在“我的预约”自行取消，再重新预约；管理员如需频繁代操作，应扩展专用管理操作界面或云函数。此限制不影响用户端新增和取消的自动同步。

## 4. 发布前检查

1. 上传部署 `gallery` 云函数并确认环境 ID。
2. 录入真实展览、馆方联系方式和开放时段。
3. 用两名微信用户测试：填写姓名/手机号、预约、重复预约、名额满、取消、重新预约，并在控制台核对 `bookings` 和 `slots`。
4. 按微信小程序平台要求配置隐私说明与手机号授权说明，再提交微信审核发布。
