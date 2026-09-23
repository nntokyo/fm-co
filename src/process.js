import spawn from 'cross-spawn'

const MAX_CAPTURE = 2 * 1024 * 1024

function appendCapped(current, chunk) {
  const next = current + chunk.toString('utf8')
  if (next.length <= MAX_CAPTURE) return next
  return next.slice(-MAX_CAPTURE)
}

export function runProcess(command, args, {
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = 0,
  input = null,
} = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let spawnError = null
    let timer = null
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    child.stdout?.on('data', (chunk) => { stdout = appendCapped(stdout, chunk) })
    child.stderr?.on('data', (chunk) => { stderr = appendCapped(stderr, chunk) })
    child.on('error', (error) => { spawnError = error })

    if (input !== null && child.stdin) {
      child.stdin.end(input)
    } else {
      child.stdin?.end()
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
      timer.unref?.()
    }

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? 1, signal, stdout, stderr, spawnError })
    })
  })
}
