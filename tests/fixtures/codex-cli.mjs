// Offline CLI protocol fixture: no network, credentials, or model calls.
let prompt = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) prompt += chunk
const mode =
  process.env.CHAT_TEST_MODE === 'conditional'
    ? ['hang', 'failure', 'empty'].includes(prompt)
      ? prompt
      : ''
    : process.env.CHAT_TEST_MODE
if (mode === 'failure') {
  process.stdout.write(
    JSON.stringify({ type: 'turn.failed', error: { message: '로그인이 필요합니다.' } }) + '\n'
  )
  process.exitCode = 1
} else if (mode === 'empty') {
  process.stdout.write('{"type":"turn.completed"}\n')
} else {
  if (process.env.CHAT_TEST_MODE !== 'conditional') process.stdout.write('not json\nnull\n')
  process.stdout.write('{"type":"thread.started","thread_id":"fixture-thread"}\n')
  process.stdout.write('{"type":"turn.started"}\n')
  if (mode === 'hang') setInterval(() => {}, 1000)
  else {
    const message = JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'answer',
        type: 'agent_message',
        text: JSON.stringify({ prompt, args: process.argv.slice(2) })
      }
    })
    const bytes = Buffer.from(message + '\n')
    // Exercise JSONL buffering and Unicode split across stdout chunks.
    const cut = bytes.indexOf(Buffer.from('한')) + 1
    process.stdout.write(bytes.subarray(0, cut))
    setTimeout(() => {
      process.stdout.write(bytes.subarray(cut))
      process.stdout.write(
        '{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1}}'
      )
    }, 10)
  }
}
