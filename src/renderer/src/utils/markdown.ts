import MarkdownIt from 'markdown-it'

// Raw HTML stays escaped; markdown-it also rejects unsafe link protocols.
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })

export function renderMarkdown(text: string): string {
  return markdown.render(text)
}
