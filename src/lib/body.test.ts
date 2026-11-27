import { describe, expect, it } from 'vitest'
import { readJsonBody } from './body'

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers,
    body,
  })
}

describe('readJsonBody', () => {
  it('parses a normal JSON body', async () => {
    const result = await readJsonBody(jsonRequest(JSON.stringify({ name: 'tee' })))
    expect(result).toEqual({ ok: true, value: { name: 'tee' } })
  })

  it('treats an empty body as an empty object', async () => {
    expect(await readJsonBody(jsonRequest(''))).toEqual({ ok: true, value: {} })
  })

  it('rejects invalid JSON', async () => {
    expect(await readJsonBody(jsonRequest('{nope'))).toEqual({ ok: false, reason: 'bad_json' })
  })

  it('rejects a body over the cap', async () => {
    const big = JSON.stringify({ text: 'x'.repeat(2048) })
    expect(await readJsonBody(jsonRequest(big), 128)).toEqual({
      ok: false,
      reason: 'too_large',
    })
  })

  it('rejects a declared content-length over the cap without reading', async () => {
    const request = {
      headers: new Headers({ 'content-length': '999999' }),
      body: null,
    } as unknown as Request
    expect(await readJsonBody(request, 128)).toEqual({ ok: false, reason: 'too_large' })
  })
})
