import { createHash } from 'node:crypto'
import { runProcess } from './process.js'

function digest(parts) {
  return createHash('sha256').update(parts.join('\0')).digest('hex')
}

export async function gitWorkspaceFingerprint(cwd = process.cwd(), runner = runProcess) {
  const inside = await runner('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return null

  const commands = [
    ['status', '--porcelain=v1', '-z'],
    ['diff', '--no-ext-diff', '--binary', '--'],
    ['diff', '--cached', '--no-ext-diff', '--binary', '--'],
  ]
  const outputs = []
  for (const args of commands) {
    const res = await runner('git', args, { cwd })
    if (res.code !== 0) return null
    outputs.push(res.stdout)
  }
  return digest(outputs)
}
