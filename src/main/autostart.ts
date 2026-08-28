import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function applyAutostart(enable: boolean): void {
  if (process.platform === 'linux') {
    // Linux 没有统一的登录项 API，直接维护 .desktop 自启动文件
    const dir = join(homedir(), '.config', 'autostart')
    const file = join(dir, 'notify.desktop')
    if (enable) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        file,
        ['[Desktop Entry]', 'Type=Application', 'Name=Notify', `Exec="${process.execPath}"`, 'X-GNOME-Autostart-enabled=true'].join('\n')
      )
    } else if (existsSync(file)) {
      unlinkSync(file)
    }
    return
  }
  app.setLoginItemSettings({ openAtLogin: enable })
}
