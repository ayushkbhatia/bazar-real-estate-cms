"use client";

import { useState } from "react";

/**
 * The viewer's fetched files, one entry per file per mount of the viewer: the
 * cache lives as long as the page, so a file is opened — and its open logged —
 * once per visit (cms/00-foundations §8). Kept apart from the stage, which
 * loads in the browser only.
 */
export type FileCache = Map<string, Promise<unknown>>;

export function useFileCache(): FileCache {
  const [cache] = useState<FileCache>(() => new Map());
  return cache;
}
