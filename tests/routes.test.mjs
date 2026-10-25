import test from 'node:test'
import assert from 'node:assert/strict'
import { currentPath, getEntry, isAppPath } from '../src/routes.js'

function location(pathname, search = '') { globalThis.window = { location: { pathname, search } } }

test('login, parent portal and onboarding URLs reach the app rather than sales or a fake daycare slug', () => {
  for (const path of ['/login', '/portal', '/onboarding', '/app', '/demo']) {
    location(path)
    assert.equal(isAppPath(), true, path)
    assert.equal(getEntry().kind, 'normal', path)
  }
})

test('onboarding and join links retain their distinct intent and token', () => {
  location('/signup'); assert.deepEqual(getEntry(), { kind: 'owner' })
  location('/join', '?t=parent-invite'); assert.deepEqual(getEntry(), { kind: 'join', token: 'parent-invite' })
  location('/onboard', '?token=employee-onboarding'); assert.deepEqual(getEntry(), { kind: 'onboard', token: 'employee-onboarding' })
  location('/sunshine-daycare', '?t=facility-invite'); assert.deepEqual(getEntry(), { kind: 'slug', slug: 'sunshine-daycare', token: 'facility-invite' })
})

test('marketing, legal and resource URLs are not mistaken for daycare portals', () => {
  for (const path of ['/', '/partners', '/whitelabel', '/for-childcare', '/terms', '/privacy', '/resources', '/guides', '/tools', '/research', '/about', '/childcare']) {
    location(path)
    assert.equal(isAppPath(), false, path)
    assert.equal(getEntry().kind, 'normal', path)
  }
})

test('trailing slashes preserve login and onboarding intent', () => {
  location('/login///'); assert.equal(currentPath(), '/login'); assert.equal(isAppPath(), true)
  location('/join/', '?token=parent-invite'); assert.deepEqual(getEntry(), { kind: 'join', token: 'parent-invite' })
})
