import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as fs from 'fs'

async function installScoop(): Promise<void> {
  const userProfile = process.env.USERPROFILE
  if (!userProfile) {
    throw new Error('USERPROFILE environment variable is not set')
  }

  const shimPath = path.join(userProfile, 'scoop', 'shims')

  core.addPath(shimPath)
  core.info(`Added scoop shims to PATH`)

  try {
    await exec.exec('scoop', ['--version'], {silent: true})
    core.info('scoop is already installed')
    return
  } catch (error) {
    core.info('scoop not found, installing...')
  }

  const installCommand = 'Invoke-WebRequest -useb get.scoop.sh | Invoke-Expression'
  await exec.exec('powershell', ['-Command', installCommand])
  core.info('scoop installed successfully')

  await exec.exec('scoop', ['--version'])
}

async function installScoopPackage(
  packageName: string,
  checkCommand: string[],
  bucket?: string
): Promise<string | null> {
  // add bucket if needed
  if (bucket) {
    try {
      await exec.exec('scoop', ['bucket', 'add', bucket], {silent: true})
    } catch (error) {
      // ignore this for now
    }
  }

  // see if package is already installed
  let isInstalled = false
  try {
    await exec.exec(checkCommand[0], checkCommand.slice(1), {silent: true})
    isInstalled = true
    core.info(`${packageName} is already installed`)
  } catch (error) {
    core.info(`${packageName} not found. installing...`)
  }

  if (!isInstalled) {
    await exec.exec('scoop', ['install', packageName])
    core.info(`${packageName} installed successfully`)

    await exec.exec(checkCommand[0], checkCommand.slice(1))
  }

  // get installation path prefix
  const userProfile = process.env.USERPROFILE
  if (!userProfile) {
    throw new Error('USERPROFILE environment variable is not set')
  }

  const packagePath = path.join(userProfile, 'scoop', 'apps', packageName, 'current')
  if (fs.existsSync(packagePath)) {
    return packagePath
  }

  const appsDir = path.join(userProfile, 'scoop', 'apps', packageName)
  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir, {withFileTypes: true})
    const dirs = entries.filter(e => e.isDirectory())
    if (dirs.length > 0) {
      return path.join(appsDir, dirs[0].name)
    }

    return appsDir
  }

  return null
}

// Main entry point
async function run(): Promise<void> {
  try {

    if (process.platform !== 'win32') {
      core.setFailed(`pewbuild is only supported on Windows. Current platform: ${process.platform}`)
      return
    }

    await installScoop()
    await installScoopPackage('git', ['git', '--version'])
    await installScoopPackage('tortoisesvn', ['svn', '--version'], 'extras')
    await installScoopPackage('pwsh', ['pwsh', '-Version'])
    await installScoopPackage('p4v', ['p4', '-V'], 'extras')

    core.info('Successfully configured runner')

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}

run()
