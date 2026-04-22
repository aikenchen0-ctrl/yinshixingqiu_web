#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import unicodedata
from pathlib import Path

from build_kb import chinese_bigrams, latin_terms

QUERY_SPLIT_RE = re.compile(r"[\s,，。！？!?；;：:/\\()（）\[\]【】\"'“”‘’]+")

BASE_SELECT_SQL = """
    SELECT
        chunks.id AS chunk_id,
        articles.id AS article_id,
        articles.title,
        articles.published_date,
        articles.path,
        articles.topics_json,
        articles.summary AS article_summary,
        article_views.worldview_summary,
        article_views.core_claims_json,
        article_views.causal_links_json,
        article_views.stances_json,
        article_views.rhetoric_markers_json,
        chunks.chunk_index,
        chunks.chunk_text
    FROM chunks
    JOIN articles ON articles.id = chunks.article_id
    LEFT JOIN article_views ON article_views.article_id = articles.id
"""


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFKC", value or "").lower().strip()


def unique_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def extract_query_terms(query: str) -> list[str]:
    normalized = normalize_text(query)
    parts = []
    for part in QUERY_SPLIT_RE.split(normalized):
      stripped = part.strip("+-_ ")
      if len(stripped) < 2:
          continue
      parts.append(stripped)
    return unique_keep_order(parts)


def expand_fts_tokens(term: str) -> set[str]:
    tokens = set(chinese_bigrams(term))
    tokens.update(latin_terms(term))

    chinese_only = "".join(re.findall(r"[\u4e00-\u9fff]+", term))
    if chinese_only and chinese_only != term:
        tokens.update(chinese_bigrams(chinese_only))

    latin_only = "".join(re.findall(r"[A-Za-z0-9_\-]+", term))
    if len(latin_only) >= 2:
        tokens.add(latin_only.lower())

    return {token for token in tokens if len(token) >= 2}


def build_fts_match(terms: list[str], query: str) -> str:
    tokens: set[str] = set()
    for term in terms:
        tokens.update(expand_fts_tokens(term))

    if not tokens:
        tokens.update(chinese_bigrams(query))
        tokens.update(latin_terms(query))

    escaped = [f'"{token.replace("\"", "\"\"")}"' for token in sorted(tokens)]
    return " OR ".join(escaped)


def build_where_clauses(prefix: str, topic: str | None, date_from: str | None, date_to: str | None):
    clauses: list[str] = []
    params: list[str] = []

    if topic:
        clauses.append(f"{prefix}.topics_json LIKE ?")
        params.append(f"%{topic}%")
    if date_from:
        clauses.append(f"({prefix}.published_date IS NOT NULL AND {prefix}.published_date >= ?)")
        params.append(date_from)
    if date_to:
        clauses.append(f"({prefix}.published_date IS NOT NULL AND {prefix}.published_date <= ?)")
        params.append(date_to)

    return clauses, params


def fetch_fts_candidates(
    conn: sqlite3.Connection,
    match_query: str,
    candidate_limit: int,
    topic: str | None,
    date_from: str | None,
    date_to: str | None,
):
    if not match_query:
        return []

    clauses, params = build_where_clauses("base", topic, date_from, date_to)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT base.*, bm25(chunks_fts) AS fts_score
        FROM chunks_fts
        JOIN (
            {BASE_SELECT_SQL}
        ) AS base ON base.chunk_id = chunks_fts.rowid
        {where_sql}
        {'AND' if where_sql else 'WHERE'} chunks_fts MATCH ?
        ORDER BY fts_score
        LIMIT ?
    """
    return conn.execute(sql, [*params, match_query, candidate_limit]).fetchall()


def fetch_like_candidates(
    conn: sqlite3.Connection,
    terms: list[str],
    candidate_limit: int,
    topic: str | None,
    date_from: str | None,
    date_to: str | None,
):
    clauses, params = build_where_clauses("base", topic, date_from, date_to)

    if terms:
        like_groups = []
        for term in terms:
            pattern = f"%{term}%"
            like_groups.append(
                "("
                + " OR ".join(
                    [
                        "LOWER(base.title) LIKE ?",
                        "LOWER(base.path) LIKE ?",
                        "LOWER(base.topics_json) LIKE ?",
                        "LOWER(base.article_summary) LIKE ?",
                        "LOWER(COALESCE(base.worldview_summary, '')) LIKE ?",
                        "LOWER(base.chunk_text) LIKE ?",
                    ]
                )
                + ")"
            )
            params.extend([pattern] * 6)
        clauses.append("(" + " OR ".join(like_groups) + ")")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT base.*, NULL AS fts_score
        FROM (
            {BASE_SELECT_SQL}
        ) AS base
        {where_sql}
        ORDER BY base.published_date DESC, base.chunk_index ASC
        LIMIT ?
    """
    return conn.execute(sql, [*params, candidate_limit]).fetchall()


def merge_candidates(*candidate_rows):
    merged: dict[int, dict] = {}

    for rows in candidate_rows:
        for row in rows:
            chunk_id = int(row["chunk_id"])
            current = merged.get(chunk_id)
            if not current:
                merged[chunk_id] = dict(row)
                continue
            current_fts_score = current.get("fts_score")
            next_fts_score = row["fts_score"]
            if next_fts_score is not None and (current_fts_score is None or next_fts_score < current_fts_score):
                current["fts_score"] = next_fts_score

    return list(merged.values())


def decode_topics(topics_json: str) -> list[str]:
    return json.loads(topics_json) if topics_json else []


def term_in_text(term: str, field_text: str) -> bool:
    if not term or not field_text:
        return False
    if re.fullmatch(r"[a-z0-9_\-]+", term):
        pattern = re.compile(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])")
        return bool(pattern.search(field_text))
    return term in field_text


def matched_terms(field_text: str, terms: list[str]) -> set[str]:
    return {term for term in terms if term_in_text(term, field_text)}


def score_candidate(candidate: dict, normalized_query: str, query_terms: list[str]) -> dict | None:
    title_text = normalize_text(candidate["title"])
    path_text = normalize_text(candidate["path"])
    topics = decode_topics(candidate["topics_json"])
    topics_text = normalize_text(" ".join(topics))
    summary_text = normalize_text(candidate["article_summary"])
    worldview_text = normalize_text(candidate["worldview_summary"] or "")
    chunk_text = normalize_text(candidate["chunk_text"])
    combined_text = "\n".join([title_text, path_text, topics_text, summary_text, worldview_text, chunk_text])

    title_hits = matched_terms(title_text, query_terms)
    topic_hits = matched_terms(topics_text, query_terms)
    path_hits = matched_terms(path_text, query_terms)
    summary_hits = matched_terms(f"{summary_text}\n{worldview_text}", query_terms)
    chunk_hits = matched_terms(chunk_text, query_terms)
    total_hits = set().union(title_hits, topic_hits, path_hits, summary_hits, chunk_hits)

    exact_query_match_title = bool(normalized_query and normalized_query in title_text)
    exact_query_match_any = bool(normalized_query and normalized_query in combined_text)

    if query_terms:
        required_matches = 1 if len(query_terms) == 1 else max(2, math.ceil(len(query_terms) * 0.6))
        if not exact_query_match_any and len(total_hits) < required_matches:
            return None

    coverage = 1.0 if not query_terms else len(total_hits) / len(query_terms)
    final_score = 0.0
    final_score += len(total_hits) * 20
    final_score += len(title_hits) * 18
    final_score += len(topic_hits) * 16
    final_score += len(path_hits) * 8
    final_score += len(summary_hits) * 7
    final_score += len(chunk_hits) * 5
    final_score += coverage * 16

    if exact_query_match_title:
        final_score += 28
    elif exact_query_match_any:
        final_score += 18

    fts_score = candidate.get("fts_score")
    if fts_score is not None:
        final_score += max(0.0, min(14.0, -float(fts_score)))

    if candidate["published_date"]:
        final_score += 1.5
    if int(candidate["chunk_index"]) == 1:
        final_score += 0.5

    scored = dict(candidate)
    scored["topics"] = topics
    scored["score"] = round(final_score, 4)
    scored["_matched_terms"] = len(total_hits)
    scored["_exact_query_match"] = exact_query_match_any
    return scored


def published_date_key(value: str | None) -> str:
    return value or ""


def published_date_sort_value(value: str | None) -> int:
    if not value:
        return 0
    return int(value.replace("-", ""))


def build_result_identity(item: dict) -> str:
    title = normalize_text(item.get("title") or "")
    published_date = item.get("published_date") or ""
    return f"{title}::{published_date}"


def select_results(candidates: list[dict], limit: int) -> list[dict]:
    ordered = sorted(
        candidates,
        key=lambda item: (
            -float(item["score"]),
            -published_date_sort_value(item["published_date"]),
            -int(item["_matched_terms"]),
            int(item["chunk_index"]),
            item["path"],
        ),
        reverse=False,
    )

    results: list[dict] = []
    seen_articles: set[str] = set()

    for item in ordered:
        identity = build_result_identity(item)
        if identity in seen_articles:
            continue
        seen_articles.add(identity)
        results.append(item)
        if len(results) >= limit:
            break

    return results


def run_query(
    conn: sqlite3.Connection,
    query: str,
    limit: int,
    topic: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    normalized_query = normalize_text(query)
    query_terms = extract_query_terms(query)
    candidate_limit = max(limit * 25, 80)

    fts_match = build_fts_match(query_terms, query)
    fts_candidates = fetch_fts_candidates(conn, fts_match, candidate_limit, topic, date_from, date_to)
    like_candidates = fetch_like_candidates(conn, query_terms, candidate_limit, topic, date_from, date_to)
    merged = merge_candidates(fts_candidates, like_candidates)

    if not query_terms and not normalized_query:
        scored = []
        for row in merged:
            item = dict(row)
            item["topics"] = decode_topics(item["topics_json"])
            item["score"] = 1.0 if item["published_date"] else 0.5
            item["_matched_terms"] = 0
            item["_exact_query_match"] = False
            scored.append(item)
        return select_results(scored, limit)

    scored_candidates = []
    for candidate in merged:
        scored = score_candidate(candidate, normalized_query, query_terms)
        if scored:
            scored_candidates.append(scored)

    return select_results(scored_candidates, limit)


def render_results(rows) -> str:
    parts: list[str] = []
    for idx, row in enumerate(rows, start=1):
        topics = "、".join(row["topics"])
        core_claims = "；".join(json.loads(row["core_claims_json"])[:2]) if row["core_claims_json"] else ""
        rhetoric = "、".join(json.loads(row["rhetoric_markers_json"])) if row["rhetoric_markers_json"] else ""
        snippet = row["chunk_text"][:360].replace("\n", " ")
        parts.append(
            f"[{idx}] {row['title']}\n"
            f"日期: {row['published_date'] or '未知'} | 分块: {row['chunk_index']} | 主题: {topics or '未标注'}\n"
            f"路径: {row['path']}\n"
            f"相关度: {float(row['score']):.4f}\n"
            f"观点层: {row['worldview_summary'] or '无'}\n"
            f"核心判断: {core_claims or '无'}\n"
            f"修辞特征: {rhetoric or '无'}\n"
            f"摘要: {snippet}\n"
        )
    return "\n".join(parts)


def export_context(rows, query: str) -> str:
    lines = [f"# 检索主题\n{query}\n", "# 可直接喂给大模型的上下文"]
    for idx, row in enumerate(rows, start=1):
        core_claims = json.loads(row["core_claims_json"]) if row["core_claims_json"] else []
        causal_links = json.loads(row["causal_links_json"]) if row["causal_links_json"] else []
        stances = json.loads(row["stances_json"]) if row["stances_json"] else []
        rhetoric = json.loads(row["rhetoric_markers_json"]) if row["rhetoric_markers_json"] else []
        topics = "、".join(row["topics"])
        lines.append(
            f"## 证据 {idx}\n"
            f"- 标题: {row['title']}\n"
            f"- 日期: {row['published_date'] or '未知'}\n"
            f"- 路径: {row['path']}\n"
            f"- 主题: {topics or '未标注'}\n"
            f"- 世界观摘要: {row['worldview_summary'] or '无'}\n"
            f"- 核心结论: {'；'.join(core_claims) or '无'}\n"
            f"- 因果链: {'；'.join(causal_links) or '无'}\n"
            f"- 敌我判断: {'；'.join(stances) or '无'}\n"
            f"- 修辞特征: {'、'.join(rhetoric) or '无'}\n"
            f"- 分块: {row['chunk_index']}\n"
            f"- 相关度: {float(row['score']):.4f}\n"
            f"- 内容:\n{row['chunk_text']}\n"
        )
    lines.append(
        "## 输出约束\n"
        "- 先总结这些历史文章的共同世界观和推理链。\n"
        "- 再结合近期事件补充，但必须把新事实与历史观点分开写。\n"
        "- 不得把历史文章中的预测当作今天已经验证的事实。\n"
        "- 若证据不足，明确说明哪一部分需要外部最新资料补充。"
    )
    return "\n".join(lines)


def render_json(rows) -> str:
    results = []
    for idx, row in enumerate(rows, start=1):
        results.append(
            {
                "rank": idx,
                "title": row["title"],
                "date": row["published_date"],
                "path": row["path"],
                "topics": row["topics"],
                "chunkIndex": row["chunk_index"],
                "score": row["score"],
                "worldviewSummary": row["worldview_summary"] or "",
                "coreClaims": json.loads(row["core_claims_json"]) if row["core_claims_json"] else [],
                "causalLinks": json.loads(row["causal_links_json"]) if row["causal_links_json"] else [],
                "stances": json.loads(row["stances_json"]) if row["stances_json"] else [],
                "rhetoricMarkers": json.loads(row["rhetoric_markers_json"]) if row["rhetoric_markers_json"] else [],
                "snippet": row["chunk_text"][:360],
            }
        )
    return json.dumps(results, ensure_ascii=False, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Query the local Xueyin knowledge base.")
    parser.add_argument("query", nargs="?", default="", help="Search query in Chinese or English.")
    parser.add_argument("--db", type=Path, default=Path("kb/data/xueyin_kb.sqlite"), help="SQLite database path.")
    parser.add_argument("--limit", type=int, default=8, help="Maximum number of chunks to return.")
    parser.add_argument("--topic", help="Optional topic filter, for example: 金融货币")
    parser.add_argument("--date-from", help="Optional inclusive date filter, for example: 2019-01-01")
    parser.add_argument("--date-to", help="Optional inclusive date filter, for example: 2020-12-31")
    parser.add_argument("--export-context", type=Path, help="Write an LLM-ready markdown context file.")
    parser.add_argument("--json", action="store_true", help="Output results as JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    try:
        rows = run_query(conn, args.query, args.limit, args.topic, args.date_from, args.date_to)
    finally:
        conn.close()
    if not rows:
        if args.json:
            print(json.dumps([], ensure_ascii=False))
        else:
            print("No results.")
        return
    if args.json:
        print(render_json(rows))
    else:
        print(render_results(rows))
    if args.export_context:
        args.export_context.parent.mkdir(parents=True, exist_ok=True)
        args.export_context.write_text(export_context(rows, args.query), encoding="utf-8")
        if not args.json:
            print(f"\nContext exported to: {args.export_context}")


if __name__ == "__main__":
    main()
