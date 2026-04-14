# Henry 的技术写作风格

基于 `style-guide-template.md` 定制的个人写作风格。

---

## 作者信息

```yaml
author_name: "Henry"
pen_name: "笔者"
affiliation: "字节跳动"
role: "技术创作者 / DeerFlow Maintainer"
```

## 目标读者

```yaml
audience: "字节跳动同事及技术社区"
expertise_level: "中高级"
industry: "AIGC / AI Agent / 大模型应用"
reader_count_goal: "10000+"  # ByteTech 平台目标阅读量
```

## 文章结构

```yaml
preferred_length: "3000-5000"
heading_style: "h1"              # 使用一级标题，便于导出飞书/Word
include_toc: false
include_summary: true
title_format: "setext"           # 文章大标题使用 ======= 格式
```

## 语言与排版

### 中英文混排

```yaml
english_names: "keep_original"   # Harrison 而非"哈里森"
technical_terms: "english_with_url"  # 首次出现附带官方文档 URL
url_for_terms: true
url_must_be_verified: true       # URL 必须经过验证
```

### 标点符号

```yaml
chinese_punctuation: "full_width"    # 使用全角标点 ，。：！
quotation_marks: "中文双引号"         # 使用 "" 而非 「」 或 ""
```

### Mermaid 流程图

```yaml
use_mermaid: true                # 技术文章中的流程图使用 Mermaid 格式
```

## 引用风格

```yaml
quote_style: "blockquote"
citation_position: "end"
max_quote_length: 80
preserve_key_quotes: true        # 保留关键人物的原话
```

## 配图风格

```yaml
illustration_style: "flat_illustration, isometric"
color_scheme: "tech_blue_purple_orange"
background: "clean_white"
text_language: "chinese"
aspect_ratios:
  cover: "3:2"
  inline: "16:9"
  comparison: "16:9"
  timeline: "21:9"
  concept: "4:3"
  square: "1:1"
```

### 配图创意偏好

```yaml
preferred_metaphors:
  hierarchy: "乐高积木（散件→积木桶→套件）"
  evolution: "交通工具（自行车→汽车→自动驾驶）"
  exploration: "探险家（自主探索、产出地图）"
  context_engineering: "DJ 混音台（调整不同音轨）"
  workspace: "工匠工作台（有序的工具和材料）"
  memory: "珊瑚礁生长（逐渐积累的结构）"
  long_horizon: "马拉松（持续奔跑、自主配速）"

aigc_prompt_format: "structured_json"
common_property: "type: image-prompt"
```

### 常用配图类型

| 类型 | 用途 | 推荐宽高比 |
|------|------|-----------|
| cover | 文章封面 | 3:2 |
| comparison | 概念对比（如 Framework vs Harness） | 16:9 |
| timeline | 技术演进、时代划分 | 21:9 |
| concept | 核心概念可视化 | 4:3 |
| metaphor | 抽象概念的具象比喻 | 16:9 |
| hierarchy | 架构层次、技术栈 | 16:9 |

## 语气与表达

```yaml
tone: "professional_friendly"
perspective: "实践者视角"          # 作为 DeerFlow Maintainer 的实践者身份
include_personal_projects: true  # 适时融入 DeerFlow 等个人项目
```

### 特殊要求

```yaml
avoid_phrases:
  - "首先、其次、最后"
  - "值得注意的是"
  - "需要指出的是"
  - "众所周知"
  - "让我们一起来看看"
  - "接下来"（过度使用时）

writing_habits:
  - "开篇说明写作动机和信息来源"
  - "核心概念用小节详细展开"
  - "总结部分用编号列表回顾要点"
  - "文末附参考资料链接"
  - "适时引入自己的项目作为实践案例"
```

## Frontmatter 模板

```yaml
---
title: ""
description: ""
cover_prompt:
  type: "image-prompt"
  category: "cover"
  title: ""
  subtitle: ""
  visual_elements:
    main_subject: ""
    supporting_elements: []
    mood: "科技感"
  style:
    illustration_type: "flat illustration"
    color_scheme: ["tech blue", "warm orange"]
    background: "clean white"
  aspect_ratio: "3:2"
  text_overlay:
    enabled: true
    language: "chinese"
date: ""
author: "Henry"
tags: []
platform: "ByteTech"
---
```

---

## 写作签名

文章中可适时提及：
- DeerFlow（20k+ stars 开源项目）
- 字节跳动技术创作者身份
- ByteTech Top KOL 身份

但避免过度自我推销，保持技术内容为主。
