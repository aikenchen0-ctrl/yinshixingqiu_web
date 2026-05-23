import path from 'node:path'
import { describe, expect, it } from 'vitest'

import manifest from '../manifest.config'

function collectRuntimeEntryBasenames() {
  const names = []

  if (manifest.background?.service_worker) {
    names.push(path.basename(manifest.background.service_worker))
  }

  for (const entry of manifest.content_scripts || []) {
    for (const scriptPath of entry.js || []) {
      names.push(path.basename(scriptPath))
    }
  }

  return names
}

describe('manifest runtime entry basenames', () => {
  it('keeps background and content-script entry basenames unique', () => {
    const basenames = collectRuntimeEntryBasenames()
    expect(new Set(basenames).size).toBe(basenames.length)
  })
})
