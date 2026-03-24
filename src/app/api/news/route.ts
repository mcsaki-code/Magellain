import { NextResponse } from "next/server";
import Parser from "rss-parser";

// ─── Feed Configuration ────────────────────────────────────────────
// Curated sailing news sources, ordered by relevance to Great Lakes racing sailors

interface FeedSource {
  name: string;
  url: string;
  icon: string; // Short identifier for UI
  priority: number; // Lower = higher priority for dedup/ordering
}

const FEEDS: FeedSource[] = [
  {
    name: "Scuttlebutt Sailing",
    url: "https://www.sailingscuttlebutt.com/feed/",
    icon: "SS",
    priority: 1,
  },
  {
    name: "Sailing World",
    url: "https://www.sailingworld.com/feed/",
    icon: "SW",
    priority: 2,
  },
  {
    name: "Sail Magazine",
    url: "https://www.sailmagazine.com/feed/",
    icon: "SM",
    priority: 3,
  },
  {
    name: "World Sailing",
    url: "https://www.sailing.org/feed/",
    icon: "WS",
    priority: 4,
  },
];

// ─── Types ─────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceIcon: string;
  pubDate: string;
  snippet: string;
  imageUrl: string | null;
}

// ─── In-memory cache ───────────────────────────────────────────────
// Cache for 5 minutes to avoid hammering RSS feeds

let cachedNews: NewsItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ───────────────────────────────────────────────────────

function extractImage(item: Parser.Item): string | null {
  // Try media content or enclosure (common RSS image fields)
  const media = (item as any)["media:content"]?.["$"]?.url
    || (item as any)["media:thumbnail"]?.["$"]?.url
    || item.enclosure?.url;
  if (media) return media;

  // Try content:encoded for first <img> tag
  const content = (item as any)["content:encoded"] || item.content || "";
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(item: Parser.Item): string {
  const raw = item.contentSnippet
    || (item as any)["content:encodedSnippet"]
    || item.content
    || item.summary
    || "";
  const text = stripHtml(raw);
  if (text.length <= 160) return text;
  return text.slice(0, 157).replace(/\s+\S*$/, "") + "...";
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

// ─── Main Handler ──────────────────────────────────────────────────

export async function GET() {
  // Return cache if fresh
  if (cachedNews && Date.now() - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json({ news: cachedNews, cached: true });
  }

  const parser = new Parser({
    timeout: 8000,
    headers: {
      "User-Agent": "MagellAIn/1.0 (Sailing News Aggregator)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    customFields: {
      item: [
        ["media:content", "media:content"],
        ["media:thumbnail", "media:thumbnail"],
        ["content:encoded", "content:encoded"],
      ],
    },
  });

  const allItems: NewsItem[] = [];

  // Fetch all feeds concurrently with individual error handling
  const feedResults = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const result = await parser.parseURL(feed.url);
        return { feed, items: result.items || [] };
      } catch (err) {
        console.warn(`[news] Failed to fetch ${feed.name}: ${(err as Error).message}`);
        return { feed, items: [] };
      }
    })
  );

  for (const result of feedResults) {
    if (result.status !== "fulfilled") continue;
    const { feed, items } = result.value;

    for (const item of items.slice(0, 10)) {
      if (!item.title || !item.link) continue;

      allItems.push({
        id: hashString(item.link),
        title: item.title.trim(),
        link: item.link,
        source: feed.name,
        sourceIcon: feed.icon,
        pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
        snippet: makeSnippet(item),
        imageUrl: extractImage(item),
      });
    }
  }

  // Sort by date (newest first), then deduplicate by similar titles
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Deduplicate: if two items have very similar titles, keep the higher-priority source
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of allItems) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  // Return top 20 items
  const news = deduped.slice(0, 20);

  // Update cache
  cachedNews = news;
  cacheTime = Date.now();

  return NextResponse.json({
    news,
    cached: false,
    sources: FEEDS.map((f) => f.name),
    fetchedAt: new Date().toISOString(),
  });
}
