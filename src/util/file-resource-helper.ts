import fs from 'node:fs'
import path from 'node:path'

export function readResourceFile(dirname: string, filename: string): string {
  return fs.readFileSync(path.join(dirname, filename), 'utf8')
}