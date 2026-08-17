/**
 * 插件自有设置路由：浏览器端“奇遇设置”页通过 /serendipity/api 读写
 * serendipity 设置命名空间（宿主在进程内调用 settings 服务）。
 *
 * 路由带与 /api 一致的浏览器信任围栏（DNS 重绑定 / 跨站防御）。
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingHttpHeaders } from 'node:http'
import type { Config } from './config.js'
import { resolveCatalog } from './config.js'
import type { SettingsFace } from './settings.js'
import type { StatusValue } from './tools.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Web 组合运行时提供（trustedHosts 等绑定后值）。 */
    webRuntime: { trustedHosts: string[] }
  }
}

/** 请求事实（结构子集）。 */
interface ApiTrustRequest {
  headers: IncomingHttpHeaders
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** 环回主机名（localhost / 127.x / ::1）。 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** 判定一次请求是否可访问插件路由（Host 头 + 同源标记）。 */
export function isTrustedApiRequest(request: ApiTrustRequest, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** 响应面的结构子集。 */
interface HttpRes {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}

/** 请求体的结构子集。 */
interface HttpReq {
  on(event: 'data', cb: (chunk: Buffer) => void): void
  on(event: 'end', cb: () => void): void
  on(event: 'error', cb: (error: Error) => void): void
}

function writeJson(res: HttpRes, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

function writeOk(res: HttpRes, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

function writeError(res: HttpRes, status: number, code: string, message: string): void {
  writeJson(res, status, { ok: false, error: { code, message } })
}

async function readJsonBody(req: HttpReq): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw === '') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** 主题目录视图（设置页“主题”卡片网格用）。 */
function catalogView(config: Config): { themes: { id: string; name: string; weight: number; enabled: boolean }[] } {
  const disabled = new Set(config.disabledThemes)
  return {
    // 全部主题（含被禁用的 / 非单选选中的）：它们都必须出现在卡片网格里，才能切换过去。
    // 单选模式（theme 非空）下 enabled 以 theme 为准，否则回退到 disabledThemes。
    themes: resolveCatalog({ ...config, disabledThemes: [], theme: '' }).map(theme => ({
      id: theme.id,
      name: theme.name,
      weight: theme.weight,
      enabled: config.theme !== '' ? config.theme === theme.id : !disabled.has(theme.id),
    })),
  }
}

/**
 * 挂载 /serendipity/api 前缀路由：
 * - settings.get     读取当前配置 + 修订号
 * - settings.update  合并补丁（修订号守卫）
 * - settings.catalog 主题目录（名称/权重/启用状态）
 * - profile.get      读取角色档案视图（等级/属性/最近奇遇）
 */
export function registerSerendipityRoutes(
  ctx: Context,
  face: () => SettingsFace,
  config: () => Config,
  profile: () => Promise<StatusValue>,
): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/serendipity/api',
    handler: async (req, res) => {
      const trustedHosts = ctx.webRuntime.trustedHosts
      if (!isTrustedApiRequest(req, trustedHosts)) {
        writeError(res, 403, 'forbidden', 'forbidden')
        return
      }
      if (req.method !== 'POST') {
        writeError(res, 405, 'method-error', 'method not allowed')
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/serendipity/api/')
        ? pathname.slice('/serendipity/api/'.length)
        : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, 404, 'not-found', 'unknown serendipity API method')
        return
      }
      try {
        const payload = await readJsonBody(req)
        switch (method) {
          case 'settings.get': {
            writeOk(res, face().get())
            return
          }
          case 'settings.update': {
            const patch = typeof payload.patch === 'object' && payload.patch !== null
              ? payload.patch as Record<string, unknown>
              : {}
            const expectedRevision = typeof payload.expectedRevision === 'number'
              ? payload.expectedRevision
              : undefined
            writeOk(res, await face().update(patch, expectedRevision))
            return
          }
          case 'settings.catalog': {
            writeOk(res, catalogView(config()))
            return
          }
          case 'profile.get': {
            writeOk(res, await profile())
            return
          }
          default: {
            writeError(res, 404, 'not-found', `unknown serendipity API method "${method}"`)
          }
        }
      } catch (error) {
        writeError(res, 400, 'settings-rejected', error instanceof Error ? error.message : String(error))
      }
    },
  }), 'serendipity: /serendipity/api routes')
}
