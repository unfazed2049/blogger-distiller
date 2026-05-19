"""
LLM-based Content Analysis Module

使用 LLM 替代关键词匹配进行内容分析，支持：
1. 内容分类（classify_content）
2. 观点句提取（extract_opinion_sentences）
3. 写作结构分析（analyze_writing_structure）
4. 价值词提取（extract_value_words）

设计原则：
- 单次 API 调用完成所有分析维度（减少成本和延迟）
- 结构化输出（JSON schema）确保可靠性
- 保持与关键词版本相同的输出格式（向后兼容）
- 支持 OpenAI 兼容的 API（OpenAI、Azure、本地模型）
"""

import json
import os
import time
from typing import List, Dict, Any, Optional
import requests


# ============================================================
# JSON Schema 定义
# ============================================================

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "classifications": {
            "type": "array",
            "description": "每条笔记的分类结果",
            "items": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string"},
                    "category": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1}
                },
                "required": ["note_id", "category", "confidence"]
            }
        },
        "opinions": {
            "type": "array",
            "description": "提取的观点句",
            "items": {
                "type": "object",
                "properties": {
                    "sentence": {"type": "string"},
                    "source_note_id": {"type": "string"},
                    "match_type": {"type": "string", "enum": ["判断词", "转折", "总结"]}
                },
                "required": ["sentence", "source_note_id", "match_type"]
            }
        },
        "structure": {
            "type": "object",
            "description": "写作结构统计",
            "properties": {
                "opening_types": {
                    "type": "object",
                    "description": "开头类型计数",
                    "additionalProperties": {"type": "integer"}
                },
                "ending_types": {
                    "type": "object",
                    "description": "结尾类型计数",
                    "additionalProperties": {"type": "integer"}
                }
            },
            "required": ["opening_types", "ending_types"]
        },
        "value_words": {
            "type": "array",
            "description": "高频价值词（2-4字）",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "count": {"type": "integer"}
                },
                "required": ["word", "count"]
            }
        }
    },
    "required": ["classifications", "opinions", "structure", "value_words"]
}


# ============================================================
# Prompt 模板
# ============================================================

SYSTEM_PROMPT = """你是一个专业的内容分析助手，擅长分析社交媒体笔记（小红书、抖音等）的内容特征。

你的任务是对一批笔记进行多维度分析，包括：
1. 内容分类
2. 观点句提取
3. 写作结构分析
4. 高频价值词提取

请严格按照 JSON schema 返回结构化结果。"""


def build_analysis_prompt(notes: List[Dict[str, Any]]) -> str:
    """构建统一的分析 prompt（包含 few-shot 示例）"""
    
    # Few-shot 示例
    few_shot_examples = """
## 示例 1：教程类笔记

输入笔记：
```json
[
  {
    "id": "note001",
    "title": "手把手教你做蛋糕",
    "desc": "我觉得做蛋糕最重要的是温度控制。很多人失败就是因为烤箱温度不对。#烘焙教程#",
    "tags": ["烘焙", "教程"]
  }
]
```

输出：
```json
{
  "classifications": [
    {"note_id": "note001", "category": "教程/实操", "confidence": 0.95}
  ],
  "opinions": [
    {
      "sentence": "我觉得做蛋糕最重要的是温度控制",
      "source_note_id": "note001",
      "match_type": "判断词"
    }
  ],
  "structure": {
    "opening_types": {"观点直抛": 1},
    "ending_types": {}
  },
  "value_words": [
    {"word": "蛋糕", "count": 1},
    {"word": "温度", "count": 1},
    {"word": "烤箱", "count": 1}
  ]
}
```

## 示例 2：经验分享类笔记

输入笔记：
```json
[
  {
    "id": "note002",
    "title": "踩坑总结",
    "desc": "大家都说要早起，但其实真正重要的不是几点起床，而是睡眠质量。所以我现在更关注睡前习惯。",
    "tags": ["生活", "经验"]
  }
]
```

输出：
```json
{
  "classifications": [
    {"note_id": "note002", "category": "经验分享", "confidence": 0.9}
  ],
  "opinions": [
    {
      "sentence": "但其实真正重要的不是几点起床，而是睡眠质量",
      "source_note_id": "note002",
      "match_type": "转折"
    },
    {
      "sentence": "所以我现在更关注睡前习惯",
      "source_note_id": "note002",
      "match_type": "总结"
    }
  ],
  "structure": {
    "opening_types": {},
    "ending_types": {"总结回顾": 1}
  },
  "value_words": [
    {"word": "起床", "count": 1},
    {"word": "睡眠", "count": 1},
    {"word": "质量", "count": 1},
    {"word": "习惯", "count": 1}
  ]
}
```

## 示例 3：日常 Vlog 类笔记

输入笔记：
```json
[
  {
    "id": "note003",
    "title": "今天的日常",
    "desc": "记录一下今天的一天。早上去了咖啡店，下午在家看书。你们今天都做了什么呀？",
    "tags": ["日常", "vlog"]
  }
]
```

输出：
```json
{
  "classifications": [
    {"note_id": "note003", "category": "日常/Vlog", "confidence": 0.92}
  ],
  "opinions": [],
  "structure": {
    "opening_types": {"故事开头": 1},
    "ending_types": {"开放提问": 1}
  },
  "value_words": [
    {"word": "咖啡店", "count": 1},
    {"word": "看书", "count": 1}
  ]
}
```
"""
    
    # 分类指南
    classification_guide = """
## 内容分类指南

根据笔记的标题、描述和标签，将笔记分类到以下类别之一：

1. **教程/实操**：包含"教程"、"怎么"、"如何"、"方法"、"步骤"、"手把手"、"保姆级"、"攻略"等
2. **测评/推荐**：包含"测评"、"推荐"、"安利"、"种草"、"合集"、"必备"、"宝藏"等
3. **经验分享**：包含"经验"、"心得"、"感悟"、"踩坑"、"总结"、"复盘"、"分享"、"干货"等
4. **作品展示**：包含"做了一个"、"搞了一个"、"上线"、"成果"、"作品"、"完成了"等
5. **日常/Vlog**：包含"日常"、"vlog"、"一天"、"记录"、"打卡"等
6. **其他**：无法归入以上类别的内容

返回分类时，请给出 confidence 分数（0-1），表示分类的置信度。
"""
    
    # 观点句提取指南
    opinion_guide = """
## 观点句提取指南

从笔记描述中提取包含作者观点的句子，分为三类：

1. **判断词**：包含"我觉得"、"我认为"、"其实"、"本质上"、"说白了"、"归根结底"、"核心是"、"关键在于"、"真正的"、"最重要的"等
2. **转折**：包含"但其实"、"然而"、"不是…而是"、"与其"、"看起来"、"实际上"、"大家都说"、"表面上"等
3. **总结**：包含"所以"、"因此"、"这说明"、"这意味着"、"一句话概括"、"总结一下"、"换句话说"等

要求：
- 只提取长度 >= 8 字的句子
- 每个句子截取前 120 字
- 如果笔记没有观点句，返回空数组
"""
    
    # 写作结构分析指南
    structure_guide = """
## 写作结构分析指南

分析笔记的开头和结尾模式，统计各类型的出现次数。

### 开头类型：
1. **故事开头**：以"那天"、"记得"、"有一次"、"上周"、"上个月"、"去年"、"小时候"、"从前"等开头
2. **反问开头**：以"你有没有"、"你是不是"、"为什么"、"凭什么"、"难道"、"真的吗"等开头
3. **数据开头**：开头包含"%"、"万"、"个"、"次"、"元"、"块"、"倍"、"调查"、"数据"等
4. **自嘲开头**：以"我这个"、"作为一个"、"承认"、"说实话"、"坦白"等开头
5. **观点直抛**：以"我觉得"、"我认为"、"其实"、"本质上"、"说白了"等开头

### 结尾类型：
1. **金句收尾**：结尾包含"就是"、"才是"、"而已"、"罢了"、"本质"、"归根"等
2. **行动号召**：结尾包含"关注"、"收藏"、"点赞"、"试试"、"去做"、"行动"等
3. **开放提问**：结尾包含"你呢"、"你觉得"、"评论区"、"留言"、"告诉我"、"你们"等
4. **总结回顾**：结尾包含"总结"、"所以"、"因此"、"最后"、"希望"等

要求：
- 开头判断基于前 50 字
- 结尾判断基于后 50 字
- 每条笔记只统计一种开头类型和一种结尾类型
- 返回格式：{"opening_types": {"类型名": 计数}, "ending_types": {"类型名": 计数}}
"""
    
    # 价值词提取指南
    value_words_guide = """
## 价值词提取指南

从所有笔记的描述中提取高频的有意义词汇（2-4 个汉字）。

要求：
1. 只提取 2-4 个汉字的词
2. 只保留纯汉字，过滤 emoji、数字、英文、符号
3. 排除停用词和常见短语（如"这个"、"那个"、"可以"、"没有"、"什么"、"时候"、"自己"、"觉得"、"一个"等）
4. 排除话题标签（#标签#）
5. 返回前 15 个高频词，按频次降序排列
6. 返回格式：[{"word": "词", "count": 频次}, ...]
"""
    
    # 构建实际输入
    notes_json = json.dumps(notes, ensure_ascii=False, indent=2)
    
    prompt = f"""{few_shot_examples}

---

{classification_guide}

{opinion_guide}

{structure_guide}

{value_words_guide}

---

## 现在请分析以下笔记：

```json
{notes_json}
```

请严格按照 JSON schema 返回分析结果，确保：
1. classifications 数组长度与输入笔记数量一致
2. 所有 note_id 与输入一致
3. opinions、structure、value_words 是对所有笔记的汇总分析

返回 JSON："""
    
    return prompt


# ============================================================
# OpenAI API 客户端
# ============================================================

class LLMAnalyzer:
    """LLM 分析客户端"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: str = "gpt-4o-mini",
        timeout: int = 120,
        max_retries: int = 3
    ):
        """
        初始化 LLM 分析器
        
        Args:
            api_key: OpenAI API key（默认从 OPENAI_API_KEY 环境变量读取）
            api_base: API 基础 URL（默认从 OPENAI_API_BASE 读取，或使用 OpenAI 官方）
            model: 模型名称（默认 gpt-4o-mini）
            timeout: 请求超时时间（秒）
            max_retries: 最大重试次数
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "OpenAI API key not set. Please set via:\n"
                "  1. Environment variable: OPENAI_API_KEY=your_key\n"
                "  2. Pass api_key parameter to LLMAnalyzer()"
            )
        
        self.api_base = (api_base or os.getenv("OPENAI_API_BASE") or "https://api.openai.com/v1").rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        
        self.total_tokens = 0
        self.total_cost = 0.0
    
    def analyze_notes(self, notes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        分析笔记（单次 API 调用完成所有维度）
        
        Args:
            notes: 笔记列表，每条笔记需包含 id, title, desc, tags
        
        Returns:
            dict: 包含 classifications, opinions, structure, value_words
        """
        if not notes:
            return {
                "classifications": [],
                "opinions": [],
                "structure": {"opening_types": {}, "ending_types": {}},
                "value_words": []
            }
        
        # 构建 prompt
        user_prompt = build_analysis_prompt(notes)
        
        # 调用 API
        response = self._call_api(user_prompt)
        
        # 解析结果
        result = self._parse_response(response, len(notes))
        
        return result
    
    def _call_api(self, user_prompt: str) -> Dict[str, Any]:
        """调用 OpenAI API（带重试）"""
        url = f"{self.api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,  # 降低随机性，提高一致性
        }
        
        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # 记录 token 使用量
                    usage = data.get("usage", {})
                    tokens = usage.get("total_tokens", 0)
                    self.total_tokens += tokens
                    
                    # 估算成本（gpt-4o-mini: $0.15/1M input, $0.60/1M output）
                    input_tokens = usage.get("prompt_tokens", 0)
                    output_tokens = usage.get("completion_tokens", 0)
                    cost = (input_tokens * 0.15 + output_tokens * 0.60) / 1_000_000
                    self.total_cost += cost
                    
                    print(f"  ℹ️  LLM tokens: {tokens} (cost: ${cost:.4f})")
                    
                    return data
                
                elif response.status_code == 429:
                    # Rate limit, retry with backoff
                    wait_time = 2 ** attempt
                    print(f"  ⚠️  Rate limited, retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                else:
                    error_body = response.text
                    raise Exception(f"API error {response.status_code}: {error_body}")
            
            except requests.Timeout:
                last_error = Exception(f"Request timeout after {self.timeout}s")
                if attempt < self.max_retries - 1:
                    print(f"  ⚠️  Timeout, retrying ({attempt + 1}/{self.max_retries})...")
                    time.sleep(2 ** attempt)
                    continue
            
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    print(f"  ⚠️  Error: {e}, retrying ({attempt + 1}/{self.max_retries})...")
                    time.sleep(2 ** attempt)
                    continue
        
        raise last_error or Exception("API call failed after retries")
    
    def _parse_response(self, response: Dict[str, Any], expected_count: int) -> Dict[str, Any]:
        """解析 API 响应并验证"""
        try:
            content = response["choices"][0]["message"]["content"]
            result = json.loads(content)
            
            # 验证必需字段
            if "classifications" not in result:
                result["classifications"] = []
            if "opinions" not in result:
                result["opinions"] = []
            if "structure" not in result:
                result["structure"] = {"opening_types": {}, "ending_types": {}}
            if "value_words" not in result:
                result["value_words"] = []
            
            # 验证 classifications 数量
            if len(result["classifications"]) != expected_count:
                print(f"  ⚠️  Warning: Expected {expected_count} classifications, got {len(result['classifications'])}")
            
            return result
        
        except (KeyError, json.JSONDecodeError) as e:
            print(f"  ⚠️  Failed to parse LLM response: {e}")
            # 返回空结果
            return {
                "classifications": [],
                "opinions": [],
                "structure": {"opening_types": {}, "ending_types": {}},
                "value_words": []
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """获取使用统计"""
        return {
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost
        }


# ============================================================
# 便捷函数（与 analyze.py 中的函数签名兼容）
# ============================================================

def analyze_with_llm(notes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    使用 LLM 分析笔记（便捷函数）
    
    Args:
        notes: 笔记列表，每条笔记需包含 id, title, desc, tags
    
    Returns:
        dict: 包含 classifications, opinions, structure, value_words
    """
    analyzer = LLMAnalyzer()
    return analyzer.analyze_notes(notes)
