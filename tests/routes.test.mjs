import test from 'node:test'
import assert from 'node:assert/strict'
import { currentPath, getEntry, isAppPath, isInstalledApp } from '../src/routes.js'

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

test('an older iPhone Home Screen icon saved at the root enters the app', () => {
  location('/')
  window.navigator = { standalone: true }
  assert.equal(isInstalledApp(), true)
  assert.equal(isAppPath(), true)
  assert.deepEqual(getEntry(), { kind: 'normal' })
})

test('standard standalone display mode also enters the app without requiring an auth-storage hint', () => {
  location('/')
  window.navigator = { standalone: false }
  window.matchMedia = query => ({ matches: query === '(display-mode: standalone)' })
  assert.equal(isInstalledApp(), true)
  assert.equal(isAppPath(), true)
  assert.equal('localStorage' in window, false)
})

test('ordinary Safari and an unavailable display-mode API retain the marketing root', () => {
  location('/')
  window.navigator = { standalone: false }
  assert.equal(isInstalledApp(), false)
  assert.equal(isAppPath(), false)
  window.matchMedia = () => { throw new Error('Unsupported display-mode API') }
  assert.equal(isInstalledApp(), false)
  assert.equal(isAppPath(), false)
})

test('installed mode does not turn explicit marketing, legal or public resource routes into an app entry', () => {
  for (const path of ['/partners', '/whitelabel', '/sell', '/for-childcare', '/terms', '/privacy', '/resources', '/guides', '/tools', '/research', '/about', '/childcare']) {
    location(path)
    window.navigator = { standalone: true }
    assert.equal(isInstalledApp(), true, path)
    assert.equal(isAppPath(), false, path)
    assert.deepEqual(getEntry(), { kind: 'normal' }, path)
  }
})

test('installed mode preserves signup, invite, employee onboarding and daycare-link intent', () => {
  for (const [path, search, expected] of [
    ['/signup', '', { kind: 'owner' }],
    ['/join', '?t=parent-invite', { kind: 'join', token: 'parent-invite' }],
    ['/onboard', '?token=employee-link', { kind: 'onboard', token: 'employee-link' }],
    ['/sunshine-daycare', '?t=family-invite', { kind: 'slug', slug: 'sunshine-daycare', token: 'family-invite' }],
  ]) {
    location(path, search)
    window.navigator = { standalone: true }
    assert.equal(isAppPath(), true)
    assert.deepEqual(getEntry(), expected)
    assert.equal(window.location.search, search)
  }
})

test('payment returns at the root remain app entries in ordinary browsers and installed apps', () => {
  for (const standalone of [false, true]) {
    for (const search of ['?stripe=success&session_id=example-session', '?billing=success&session_id=example-session']) {
      location('/', search)
      window.navigator = { standalone }
      assert.equal(isAppPath(), true)
      assert.equal(window.location.search, search)
    }
  }
})
