# 简历匣 · 求职侧栏

管理多个简历版本，在招聘网页旁常驻显示个人资料。默认打开快捷复制；点击网页输入框，侧栏会自动匹配、高亮并置顶对应资料，核对后可直接填入。

## 安装与升级

1. 使用 Chrome 116+，或支持 `sidePanel` API 的新版 Edge。
2. Chrome 地址栏输入 `chrome://extensions`；Edge 输入 `edge://extensions`。
3. 打开「开发者模式」→「加载已解压的扩展程序」，选择本项目的 **`extension` 文件夹**。也可解压 `dist/简历匣-v0.2.0.zip`，选择其中的 `resume-assistant` 文件夹。
4. 在浏览器工具栏固定「简历匣」，点击图标打开侧栏。
5. 点击「管理资料」编辑简历，或导入自己的 JSON 备份。也可以先导入 [`examples/profile.json`](examples/profile.json) 体验功能，示例中的姓名、学校和经历均为虚构数据。

从旧版升级：把新版文件替换到原来加载的同一目录，在扩展管理页点击「重新加载」，然后重新打开侧栏和资料工作台。数据格式保持版本 1，可继续读取原有资料和备份。无需 npm 安装或编译即可使用。

## 新的填写方式

1. 打开招聘网页的申请表，再点击工具栏的简历匣图标。
2. 侧栏默认显示 **快捷复制**，操作网页时会保持打开。
3. 点击或用 Tab 进入网页输入框，侧栏显示该字段名称，并高亮、置顶匹配资料。
4. 点击资料右侧的「填入」，只写入刚才选中的那个输入框。也可以复制后手动粘贴。
5. 在「网页填写」页可以手动选择其他资料来源，预览后点击「填入当前输入框」。

有多条教育或实习经历时，侧栏会高亮多个候选，供你选择正确记录。无匹配时可手动选择资料。网页已有内容默认保留，明确开启「允许覆盖」后才可覆盖；切换输入框会重置覆盖开关。

「撤销上次」还原最近一次填写；如果随后手动改过该内容，会保留你的修改。扩展不会点击提交或发送申请。

切换标签页、跳转地址时会清除旧输入框目标。返回已授权页面可自动恢复连接；进入新的未授权网站，需要在该网页再点击一次工具栏图标。未连接时仍可使用复制。

## 资料管理

- 个人信息、教育、实习/工作、项目、技能、自我介绍、荣誉。
- 每段教育经历支持 GPA、成绩排名、学院、导师；排名可以填写名次/总人数或百分比。
- 最多 30 份独立简历版本；经历可新增、删除、上移。
- 自动保存、JSON 追加导入和备份导出；工作台保存后，已打开的侧栏会刷新资料。

## 兼容范围

| 网页内容 | 支持方式 |
| --- | --- |
| 可见、可编辑的原生 input / textarea | 点击或 Tab 聚焦后匹配；支持文本、邮箱、电话、网址、数字、日期和月份 |
| 原生 select | 聚焦后匹配资料，填入时要求有唯一对应选项 |
| 动态添加的输入框 | 通过事件监听直接识别 |
| 同源 iframe / 开放 Shadow DOM | 支持定位和填写，包括动态插入的同源 iframe |
| 多段教育/实习 | 高亮候选，在资料中手动选定经历 |
| 无法识别语义的原生输入框 | 手动选择资料填入 |
| 自定义下拉、富文本、日期弹层、封闭 Shadow DOM | 使用快捷复制或手动填写 |
| 跨域 iframe、附件、验证码、密码、协议勾选 | 不自动填写 |

使用原生 value setter 并发送 input/change 事件以支持受控输入。网站专有逻辑仍可能拒绝填写；尚未对具体招聘网站逐站验收，也不承诺所有 React/Vue 应用兼容。只有年月的资料遇到要求完整日期的网页，会提示手动补充。

浏览器内部页面、扩展页和商店页面无法注入脚本。不含 PDF/DOCX 自动解析、自动新增网站经历行、云同步或自动投递。

## 数据和权限

- 资料保存在本机 `chrome.storage.local`，无服务器、云同步、AI 调用或分析服务。
- 权限为 `storage`、`activeTab`、`scripting`、`sidePanel`。点击工具栏后临时连接当前网页，无全站常驻权限。
- 完整资料库仅允许扩展页面读取。页面监听器发送当前选中字段的描述，填入时仅接收用户选择的值；网页可以读取被填入的内容。
- 侧栏绑定标签页和文档；切换、跳转和关闭时释放相应监听。填写前再次检查当前标签、文档和字段，防止使用失效目标。
- 本机存储和导出的 JSON 未加密。卸载会清除扩展数据，请先备份。
- `private/` 内个人文件已被 Git 忽略，打包仅复制 `extension/`，不包含个人资料、截图、测试或开发文档。
- 网页预览使用该网页来源下的 localStorage，与扩展存储独立；可用 JSON 导入/导出迁移。

## 本地预览与练习

在本项目目录运行 `npm run dev`：

- [资料工作台](http://127.0.0.1:4173/extension/workspace.html)
- [侧栏界面预览](http://127.0.0.1:4173/extension/panel.html)（网页模式仅支持资料和复制）
- [招聘练习表单](http://127.0.0.1:4173/demo/recruitment.html)

练习表单不会发送申请。安装扩展、导入资料后，在练习页点击工具栏图标，然后点击输入框验证高亮与填写。开发服务器只监听本机，只提供 `extension/` 和 `demo/`，不提供个人文件。

## 开发与验证

原生 JavaScript ES Modules、CSS、Manifest V3，无构建步骤和运行时第三方依赖。

```sh
npm test                 # 数据模型和字段匹配
npm run package          # 可加载目录及版本化 ZIP；需要 zip 命令
npm install              # 开发时安装 Playwright
npx playwright install chromium
npm run test:browser     # 临时独立 Chrome 窗口中的原生侧栏验收
```

可设置 `CHROME_PATH` 使用已有的新版本 Chrome。测试使用可显示窗口的 Chrome，因为原生侧栏不在无头模式中呈现；需要支持 DevTools `Extensions.loadUnpacked` / `triggerAction`。测试以 CDP 连接真实侧栏目标，没有将侧栏模拟成普通网页或模拟扩展 API。

```text
extension/
  lib/           数据模型、存储、匹配、UI 工具
  workspace.*    资料工作台
  panel.*        常驻侧栏、复制、实时匹配和单项填写
  content.js     输入框监听、字段验证、填写、撤销
  background.js  打开原生侧栏和释放页面监听
demo/            本机练习表单
tests/           数据模型与浏览器验收
scripts/         预览服务与打包
private/         个人导入文件（不进 Git、不打包）
examples/        可导入的虚构示例资料
artifacts/       验收截图与测试结果（不打包）
```

参考：[Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)、[Edge Sidebar](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar)、[activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)、[Chrome DevTools Extensions](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/)。
