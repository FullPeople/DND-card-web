# 素材来源

- 原版开屏素材：保留 `public/scene/startup-logo/1.PNG` 至 `4.PNG` 原始透明切图，供回退使用。1 为角色，2 为分子，3 为骰子，4 为桌面；当前开屏、中心图与左下角重组使用下述高清图层。
- 高清图标更新：用户提供的 `D:/qq_files/fuvtt1.psd`，画布为 3000 × 3000。直接导出可见的桌面、角色、分子和骰子图层，保留透明画布及图层坐标。PNG 导出和原 PSD 校验记录在 `work/r5-logo-export.json`；旧图层保持可回退。网页图标和 Apple 触控图标也使用新稿。
- 当前背景：[React Bits Shape Grid](https://reactbits.dev/backgrounds/shape-grid)，沿用主页的米白、灰绿和暖棕色调。
- 当前项目展示：[React Bits Flex Carousel](https://reactbits.dev/components/flex-carousel)，包含六项项目及用户提供的录制动画；支持竖向横幅、滑动联动详情和窄屏尺寸适配。本轮素材和点赞实现见 PROJECT-MEDIA.md。组件源码来自 React Bits 官方仓库，许可保留于 `src/react-bits/LICENSE.md` 和线上 `licenses/react-bits-20261010.txt`。
- 宽屏轮播：开屏结束后默认展示；渲染区域覆盖整个窗口，横幅沿右侧排列，弯曲效果只受窗口边缘裁切。鼠标与触摸操作区域限于右侧，保留左侧 Logo 和页面按钮的交互。
- 横幅标题、底部阴影和涂鸦边框在同一渲染流程中合成，随横幅一起扭曲。移除原来单独叠加的平面标题框。
- 指针效果来自 [React Bits Crosshair](https://reactbits.dev/animations/crosshair)，关闭坐标数字并使用暖棕色细线。按钮采用手绘双边线和按压阴影，加入 [Click Spark](https://reactbits.dev/animations/click-spark) 点击火花与参考 [Magnet](https://reactbits.dev/animations/magnet) 的轻微吸附；保留键盘焦点、禁用状态和系统减少动态效果设置。
- 首次访问优化：Logo 从原 PNG 生成 640、1280 和 1920 像素的无损 WebP，按显示尺寸与像素密度选择；原 PSD 和 3000 像素图层保留。四张项目图片生成适合展示尺寸的 WebP，保留原图来源与压缩记录，隐藏的备用图片只在需要时加载。
- 轮播模块与图片在开屏期间预载，复用已解码的图片，入场动画缩短为 0.65 秒。骰子渲染代码在轮播显示后准备，仅预载首页三种投掷需要的四种模型和对应材质；其余主题音效在实际投掷前准备。原主题贴图校验后直接解码已有数据，不再次请求相同文件。
- 骰子物理文件提供 gzip 传输副本，解压内容与原 Jolt/WASM 完全一致；不支持浏览器解压或副本加载失败时使用原文件。资源大小与校验记录位于 `review/r6-asset-optimization.json`。
- 骰子模型、物理、卡通 D20 和猫眼石 D100：已有 `D:/Desktop/DesktopDiceWebLab` 的代码及锁定资源。
- 本轮骰子演出：沿用原结果射击绘制，新增按实际结果选择的全屏彩带、朝下的 👎 表情雨和 3 朝上 D4 的下层光环。作品标题逐字保留用户提供的四条文案。
- 三角机构骰子：`D:/Desktop/3d桌面骰子/assets/themes/gray_red_three_cap/` 的主题清单、四张表面贴图和音效；数字图集按该清单从 `stage6_calibration` 原样复制。网页适配原软件 `src/assets/dice_material_mapping.cpp` 的归一化坐标、四次方径向三向投影与结果切角平面，以及 `src/graphics/composition_renderer.cpp` 的贴图采样。未新增金属球、刻槽或替代贴图。
- 原始主题贴图和数字图集 SHA-256 校验记录：`review/revision-3/asset-verification.json`。
- 5etools：已有真实网站截图，入口为 Kiwee 的 `https://5e.kiwee.top/`。
- SealChat：已有项目展示截图，入口保留用户指定的 B 站介绍视频。
- 桌面骰子截图：已有 `DesktopDiceWebLab/evidence/rolling.png`。下载提供已有原生安装包。
- 音乐板截图：已有 `音乐板/soundboard-native/evidence/preview-panel.png`。
- Cinzel、Three.js、Jolt 的原有许可文件保留于根目录、`public/licenses/`、`public/assets/licenses/` 和 `public/vendor/`。

原生桌面骰子安装包 SHA-256：`167137827096f48f96c819d562b83d65d03ae849233ebf531c143911af27e598`。

## 软件发布信息

- 桌面骰子：Windows `0.1.0-preview.10`，日期 `2026-09-27`。对应原安装包和 `D:/Desktop/3d桌面骰子/docs/validation/2026-09-27-foreground-arithmetic.md` 中的验证记录。
- MusicBoard：Windows `0.2.0`，日期 `2026-09-20`。来自[官方 v0.2.0 发布页](https://github.com/FullPeople/MusicBoard/releases/tag/v0.2.0)，发布时间按北京时间显示。
- 两个软件的 macOS 入口预留为“待发布”；当前发布记录没有 macOS 安装包。
