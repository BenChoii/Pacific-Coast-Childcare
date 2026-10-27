import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('new Home Screen installs launch the portal within the same origin and scope', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url)))
  const origin = 'https://mitten.care'
  const start = new URL(manifest.start_url, origin)
  const scope = new URL(manifest.scope, origin)
  assert.equal(start.origin, origin)
  assert.equal(start.pathname, '/app')
  assert.equal(manifest.id, '/app')
  assert.ok(start.href.startsWith(scope.href))
  assert.equal(manifest.display, 'standalone')
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
})

test('iPhone and manifest icons exist as real PNG assets at the declared dimensions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/brand\/mitten-app-180\.png"/)
  for (const size of [180, 192, 512]) {
    const png = await readFile(new URL(`../public/brand/mitten-app-${size}.png`, import.meta.url))
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
})
