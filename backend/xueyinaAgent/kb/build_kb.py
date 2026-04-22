#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
DATE_PATTERNS = [
    re.compile(r"(?P<year>20\d{2}|19\d{2})[.\-/年 ]+(?P<month>\d{1,2})[.\-/月 ]+(?P<day>\d{1,2})"),
    re.compile(r"(?P<year>20\d{2}|19\d{2})[.\-/年 ]+(?P<month>\d{1,2})"),
]
EXCLUDED_DIRS = {".git", "__pycache__", ".openclaw", "kb", ".idea", ".vscode"}
TOPIC_RULES = {
    "中美博弈": ["美国", "中国", "中美", "拜登", "特朗普", "美联储"],
    "金融货币": ["美元", "美债", "货币", "汇率", "股市", "金融", "债务", "加息", "降息", "人民币"],
    "中东": ["伊朗", "以色列", "叙利亚", "土耳其", "沙特", "巴勒斯坦", "胡塞"],
    "俄乌欧亚": ["俄罗斯", "乌克兰", "北约", "欧洲", "欧盟", "波兰"],
    "生化疫情": ["病毒", "疫情", "生化", "疫苗", "猴痘", "奥密克戎", "基因"],
    "台海东亚": ["台湾", "日本", "朝鲜", "半岛", "韩国", "萨德", "东海", "南海"],
    "内政经济": ["房地产", "楼市", "就业", "内需", "地方债", "国债", "A股", "房价"],
}


@dataclass
class Article:
    path: str
    filename: str
    file_type: str
    title: str
    published_date: str | None
    topics: list[str]
    summary: str
    full_text: str
    content_hash: str
    viewpoint: dict[str, list[str] | str]


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\u3000", " ")
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if line in {"图片", "图", "image", "Image"}:
            continue
        line = re.sub(r"\s+", " ", line)
        lines.append(line)
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def extract_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs = []
    for para in root.findall(".//w:p", NS):
        texts = [node.text or "" for node in para.findall(".//w:t", NS)]
        if texts:
            paragraphs.append("".join(texts))
    return "\n".join(paragraphs)


def read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return extract_docx_text(path)
    raw = path.read_text(encoding="utf-8", errors="ignore")
    return raw


def pick_title(text: str, path: Path) -> str:
    for line in text.splitlines():
        line = line.strip()
        if len(line) >= 4:
            return line
    return path.stem


def extract_date(text: str, filename: str) -> str | None:
    search_space = f"{filename}\n{text[:800]}"
    for pattern in DATE_PATTERNS:
        match = pattern.search(search_space)
        if not match:
            continue
        year = int(match.group("year"))
        month = int(match.group("month"))
        day = int(match.groupdict().get("day") or 1)
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
    return None


def infer_topics(text: str) -> list[str]:
    topics = []
    for name, keywords in TOPIC_RULES.items():
        if any(keyword in text for keyword in keywords):
            topics.append(name)
    return topics


def summarize(text: str, title: str, limit: int = 180) -> str:
    body = text[len(title) :].strip() if text.startswith(title) else text
    body = body.replace("\n", " ")
    body = re.sub(r"\s+", " ", body).strip()
    return body[:limit]


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"[。！？!?；;\n]+", text)
    return [part.strip(" ，,：:") for part in parts if len(part.strip()) >= 8]


def unique_keep_order(items: Iterable[str], limit: int) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
        if len(result) >= limit:
            break
    return result


def extract_viewpoint(title: str, text: str, topics: list[str]) -> dict[str, list[str] | str]:
    body = text[len(title) :].strip() if text.startswith(title) else text
    sentences = split_sentences(body)
    conclusion_markers = ("意味着", "说明", "本质", "关键", "核心", "根本", "这就是", "可见", "由此", "归根结底")
    cause_markers = ("因为", "由于", "所以", "导致", "一旦", "如果", "结果就是", "背后")
    stance_markers = ("美国", "中国", "中俄", "华尔街", "犹太", "资本", "俄罗斯", "日本", "以色列", "欧洲")
    rhetoric_markers = ("不是", "而是", "归根结底", "说到底", "换句话说", "毋庸置疑", "可见", "由此可见")

    core_claims = unique_keep_order(
        (sentence for sentence in sentences if any(marker in sentence for marker in conclusion_markers)),
        3,
    )
    if not core_claims:
        core_claims = unique_keep_order(sentences[:3], 3)

    causal_links = unique_keep_order(
        (sentence for sentence in sentences if any(marker in sentence for marker in cause_markers)),
        5,
    )

    stances = unique_keep_order(
        (sentence for sentence in sentences if any(marker in sentence for marker in stance_markers)),
        5,
    )

    rhetoric = []
    for marker in rhetoric_markers:
        if marker in body or marker in title:
            rhetoric.append(marker)

    worldview = "、".join(topics) if topics else "未标注"
    return {
        "worldview_tags": topics,
        "worldview_summary": f"文章主要落在 {worldview} 叙事框架下。",
        "core_claims": core_claims,
        "causal_links": causal_links,
        "stances": stances,
        "rhetoric_markers": rhetoric,
    }


def chinese_bigrams(text: str) -> Iterable[str]:
    for seq in re.findall(r"[\u4e00-\u9fff]{2,}", text):
        for index in range(len(seq) - 1):
            yield seq[index : index + 2]


def latin_terms(text: str) -> Iterable[str]:
    for token in re.findall(r"[A-Za-z0-9_\-]{2,}", text.lower()):
        yield token


def build_search_text(*parts: str) -> str:
    tokens = []
    for part in parts:
        if not part:
            continue
        tokens.extend(chinese_bigrams(part))
        tokens.extend(latin_terms(part))
    return " ".join(tokens)


def split_paragraphs(text: str) -> list[str]:
    return [part.strip() for part in text.split("\n\n") if part.strip()]


def chunk_text(text: str, target_size: int = 1200, overlap_chars: int = 180) -> list[str]:
    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return [text]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        candidate = f"{current}\n\n{para}".strip() if current else para
        if current and len(candidate) > target_size:
            chunks.append(current)
            tail = current[-overlap_chars:].strip()
            current = f"{tail}\n\n{para}".strip() if tail else para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def iter_source_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in {".txt", ".docx"}:
            continue
        yield path


def load_article(path: Path, root: Path) -> Article | None:
    try:
        text = normalize_text(read_text(path))
    except Exception as exc:
        print(f"[skip] {path}: {exc}")
        return None
    if len(text) < 100:
        return None
    title = pick_title(text, path)
    published_date = extract_date(text, path.name)
    topics = infer_topics(text)
    summary = summarize(text, title)
    rel_path = str(path.relative_to(root))
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return Article(
        path=rel_path,
        filename=path.name,
        file_type=path.suffix.lower().lstrip("."),
        title=title,
        published_date=published_date,
        topics=topics,
        summary=summary,
        full_text=text,
        content_hash=content_hash,
        viewpoint=extract_viewpoint(title, text, topics),
    )


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        DROP TABLE IF EXISTS chunks_fts;
        DROP TABLE IF EXISTS article_views;
        DROP TABLE IF EXISTS chunks;
        DROP TABLE IF EXISTS articles;
        DROP TABLE IF EXISTS meta;

        CREATE TABLE articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            title TEXT NOT NULL,
            published_date TEXT,
            topics_json TEXT NOT NULL,
            summary TEXT NOT NULL,
            full_text TEXT NOT NULL,
            content_hash TEXT NOT NULL
        );

        CREATE TABLE chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            search_text TEXT NOT NULL,
            char_count INTEGER NOT NULL,
            FOREIGN KEY(article_id) REFERENCES articles(id)
        );

        CREATE TABLE article_views (
            article_id INTEGER PRIMARY KEY,
            worldview_tags_json TEXT NOT NULL,
            worldview_summary TEXT NOT NULL,
            core_claims_json TEXT NOT NULL,
            causal_links_json TEXT NOT NULL,
            stances_json TEXT NOT NULL,
            rhetoric_markers_json TEXT NOT NULL,
            FOREIGN KEY(article_id) REFERENCES articles(id)
        );

        CREATE VIRTUAL TABLE chunks_fts USING fts5(
            search_text,
            content='chunks',
            content_rowid='id'
        );

        CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )


def rebuild_fts(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")


def build_database(source_dir: Path, db_path: Path) -> tuple[int, int]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        init_db(conn)
        article_count = 0
        chunk_count = 0
        for path in iter_source_files(source_dir):
            article = load_article(path, source_dir)
            if article is None:
                continue
            article_count += 1
            cursor = conn.execute(
                """
                INSERT INTO articles(path, filename, file_type, title, published_date, topics_json, summary, full_text, content_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    article.path,
                    article.filename,
                    article.file_type,
                    article.title,
                    article.published_date,
                    json.dumps(article.topics, ensure_ascii=False),
                    article.summary,
                    article.full_text,
                    article.content_hash,
                ),
            )
            article_id = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO article_views(
                    article_id, worldview_tags_json, worldview_summary, core_claims_json,
                    causal_links_json, stances_json, rhetoric_markers_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    article_id,
                    json.dumps(article.viewpoint["worldview_tags"], ensure_ascii=False),
                    article.viewpoint["worldview_summary"],
                    json.dumps(article.viewpoint["core_claims"], ensure_ascii=False),
                    json.dumps(article.viewpoint["causal_links"], ensure_ascii=False),
                    json.dumps(article.viewpoint["stances"], ensure_ascii=False),
                    json.dumps(article.viewpoint["rhetoric_markers"], ensure_ascii=False),
                ),
            )
            for chunk_index, chunk in enumerate(chunk_text(article.full_text), start=1):
                search_text = build_search_text(article.title, " ".join(article.topics), chunk)
                conn.execute(
                    """
                    INSERT INTO chunks(article_id, chunk_index, chunk_text, search_text, char_count)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (article_id, chunk_index, chunk, search_text, len(chunk)),
                )
                chunk_count += 1
        rebuild_fts(conn)
        conn.execute(
            "INSERT INTO meta(key, value) VALUES (?, ?)",
            ("build_info", json.dumps({"articles": article_count, "chunks": chunk_count}, ensure_ascii=False)),
        )
        conn.commit()
        return article_count, chunk_count
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a local knowledge base for Xueyin articles.")
    parser.add_argument("--source", type=Path, default=Path.cwd(), help="Source directory to scan.")
    parser.add_argument("--db", type=Path, default=Path("kb/data/xueyin_kb.sqlite"), help="SQLite database output path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    article_count, chunk_count = build_database(args.source.resolve(), args.db.resolve())
    print(f"Built knowledge base: {article_count} articles, {chunk_count} chunks -> {args.db}")


if __name__ == "__main__":
    main()
