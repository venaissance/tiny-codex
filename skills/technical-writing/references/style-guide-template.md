# 技术写作风格指南

本文件定义技术博客的默认写作风格。用户可基于此模板创建 `user-style.md` 来定制个人风格。

---

## 作者信息

```yaml
author_name: ""           # 署名
pen_name: "笔者"          # 文中自称
affiliation: ""           # 所属机构（可选）
```

## 目标读者

```yaml
audience: "技术从业者"     # 目标读者群体
expertise_level: "中高级"  # 假设的技术水平：入门/中级/中高级/专家
industry: ""              # 特定行业（可选）
```

## 文章结构

```yaml
preferred_length: "3000-5000"  # 字数范围
heading_style: "h1"            # 章节标题级别：h1 或 h2
include_toc: false             # 是否包含目录
include_summary: true          # 是否包含总结章节
```

## 语言与排版

### 中英文混排

```yaml
english_names: "keep_original"  # 英文名处理：keep_original（保持原文）/ transliterate（音译）
technical_terms: "english_with_chinese_first_mention"  # 首次出现时附带中文解释
url_for_terms: true             # 首次出现的专有名词是否附带官方 URL
```

### 标点符号

```yaml
chinese_punctuation: "full_width"  # 中文标点：full_width（全角）
quotation_marks: "中文双引号"       # 引号风格：中文双引号"" / 直角引号「」
```

### 示例

- ✅ 正确：Harrison 在专访中提到，"Context Engineering 是一切的核心。"
- ❌ 错误：哈里森在专访中提到,"Context Engineering是一切的核心."

## 引用风格

```yaml
quote_style: "blockquote"      # 引用方式：blockquote（引用块）/ inline（行内引用）
citation_position: "end"       # 参考资料位置：end（文末）/ footnote（脚注）
max_quote_length: 50           # 单条引用最大字数，超过则需改写
```

### 示例

引用块风格：
> 让 LLM 在循环中运行，让它完全自主决定下一步做什么——这一直是 Agent 的核心理念。

## 配图风格

```yaml
illustration_style: "flat_illustration"  # 插画风格
color_scheme: "tech_blue_purple"         # 配色方案
background: "clean_white"                # 背景
text_language: "chinese"                 # 配图文字语言
aspect_ratios:                           # 常用宽高比
  cover: "3:2"
  comparison: "16:9"
  timeline: "21:9"
  concept: "4:3"
  square: "1:1"
```

### AIGC Prompt 结构化格式

所有配图使用结构化 JSON，共性属性为 `type: "image-prompt"`：

| 类型 | category | 用途 | 推荐宽高比 |
|------|----------|------|-----------|
| 封面 | cover | 文章封面图 | 3:2 |
| 对比 | comparison | 概念对比、前后对比 | 16:9 |
| 时间线 | timeline | 技术演进、时代划分 | 21:9 |
| 概念 | concept | 核心概念可视化 | 4:3 |
| 比喻 | metaphor | 抽象概念的具象化 | 16:9 |
| 层次 | hierarchy | 架构层次、技术栈 | 16:9 |

### 配图创意方向

鼓励使用具象比喻来解释抽象概念：

| 抽象概念 | 推荐比喻 |
|----------|----------|
| 架构层次 | 乐高积木（散件→积木桶→成品套件） |
| 演进过程 | 交通工具（自行车→汽车→自动驾驶） |
| 数据流 | 管道、河流、音乐混音台 |
| 记忆/积累 | 珊瑚礁、年轮、图书馆 |
| 工作空间 | 工匠工作台、厨房、实验室 |

## 语气与表达

```yaml
tone: "professional_friendly"   # 语气：professional_friendly / academic / casual
avoid_phrases:                  # 避免使用的表达
  - "首先、其次、最后"
  - "值得注意的是"
  - "需要指出的是"
  - "众所周知"
  - "毫无疑问"
prefer_phrases:                 # 推荐的过渡方式
  - 直接陈述
  - 自然的因果连接
  - 设问引出
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
    mood: ""
  style:
    illustration_type: "flat illustration"
    color_scheme: []
    background: "clean white"
  aspect_ratio: "3:2"
  text_overlay:
    enabled: true
    language: "chinese"
date: ""
author: ""
tags: []
---
```

---

## 自定义说明

要创建个人写作风格，复制此文件为 `user-style.md` 并修改上述配置项。

常见自定义场景：

1. **学术风格**：设置 `tone: academic`，`quote_style: footnote`
2. **轻松风格**：设置 `tone: casual`，`pen_name: 我`
3. **英文读者**：设置 `text_language: english`，调整标点规则
