import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown } from '../src/renderer/src/utils/markdown.ts'

test('renders headings, emphasis, lists, tables, quotes, and links', () => {
  const html = renderMarkdown(
    [
      '## 제목',
      '',
      '**굵게** 및 *기울임*',
      '',
      '- 항목',
      '',
      '| 이름 | 값 |',
      '| --- | --- |',
      '| 예제 | 1 |',
      '',
      '> 인용문',
      '',
      '[문서](https://example.com)'
    ].join('\n')
  )
  for (const tag of ['h2', 'strong', 'em', 'ul', 'li', 'table', 'th', 'td', 'blockquote']) {
    assert.ok(html.includes(`<${tag}>`), `Missing ${tag}`)
  }
  assert.match(html, /href="https:\/\/example.com"/)
})

test('preserves fenced code and escapes markup inside code', () => {
  const html = renderMarkdown('```html\n<div>한글</div>\n```\n\n`const x = 1`')
  assert.match(html, /<pre><code class="language-html">/)
  assert.match(html, /&lt;div&gt;한글&lt;\/div&gt;/)
  assert.match(html, /<code>const x = 1<\/code>/)
})

test('escapes raw HTML and rejects executable links', () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert%281%29)\n\n[x](file:///C:/secret)'
  )
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img '))
  assert.ok(!html.includes('href="javascript:'))
  assert.ok(!html.includes('href="file:'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('supports Korean line breaks and plain URL links', () => {
  const html = renderMarkdown('첫째 줄\n둘째 줄\n\nhttps://example.com')
  assert.match(html, /첫째 줄<br>\n둘째 줄/)
  assert.match(html, /href="https:\/\/example.com"/)
})
