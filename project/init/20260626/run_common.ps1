param(
  [switch]$InitLocalDb
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ApiGatewayDir = Join-Path $ProjectRoot "apiGateWay"
$ServerDir = Join-Path $ProjectRoot "server"
$ClientDir = Join-Path $ProjectRoot "client"
$SchemaDir = Join-Path $ProjectRoot "database\schema"
$SeedDir = Join-Path $ProjectRoot "database\seed"
$SyncConfigPath = Join-Path $ScriptDir "sync_config.ps1"

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host ("==== " + $Text + " ====")
}

function Invoke-InDir([string]$Dir, [scriptblock]$Action) {
  Push-Location $Dir
  try {
    & $Action
  }
  finally {
    Pop-Location
  }
}

function Load-EnvFile([string]$FilePath) {
  $map = @{}
  Get-Content $FilePath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) {
      return
    }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)
    $map[$key] = $value
  }
  return $map
}

function Split-SqlStatements([string]$SqlText) {
  $parts = [regex]::Split($SqlText, ";\s*(\r?\n|$)")
  return @($parts | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
}

function Get-QuotedConnArg([hashtable]$Conn) {
  return "host={0} port={1} user={2} password={3} dbname={4}" -f $Conn.Host, $Conn.Port, $Conn.User, $Conn.Password, $Conn.Database
}

function Assert-ConfigFile {
  if (-not (Test-Path $SyncConfigPath)) {
    throw "缺少测试环境数据库配置文件：$SyncConfigPath。请先复制 sync_config.sample.ps1 为 sync_config.ps1 并填写测试库连接信息。"
  }
}

function Run-GitPull {
  Write-Step "1/5 git pull"
  Invoke-InDir $ProjectRoot {
    git pull
    if ($LASTEXITCODE -ne 0) {
      throw "git pull 执行失败"
    }
  }
}

function Build-Server {
  Write-Step "2/5 编译后端"
  Invoke-InDir $ServerDir {
    node ".\node_modules\typescript\bin\tsc" -p tsconfig.json
    if ($LASTEXITCODE -ne 0) {
      throw "后端编译失败"
    }
  }
}

function Build-ApiGateway {
  Write-Step "2/5 编译 apiGateWay"
  Invoke-InDir $ApiGatewayDir {
    $tscLocal = ".\node_modules\typescript\bin\tsc"
    if (Test-Path $tscLocal) {
      node $tscLocal -p tsconfig.json
    } else {
      node (Join-Path $ServerDir ".\node_modules\typescript\bin\tsc") -p tsconfig.json
    }
    if ($LASTEXITCODE -ne 0) {
      throw "apiGateWay 编译失败"
    }
  }
}

function Init-LocalDatabase([hashtable]$LocalDb) {
  Write-Step "3/5 初始化本地数据库"

  $files = @(
    Join-Path $SchemaDir "999_drop.sql"
    Join-Path $SchemaDir "001_init.sql"
    Join-Path $SeedDir "001_seed.sql"
  )

  $nodeCode = @"
import fs from 'node:fs';
import pgPkg from 'pg';
const { Client } = pgPkg;
const conn = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
};
const files = process.argv.slice(1);
const splitSql = (sql) => sql.split(/;\s*(\r?\n|$)/).map(s => s.trim()).filter(Boolean);
const run = async () => {
  const client = new Client(conn);
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const sql = fs.readFileSync(file, 'utf8');
      for (const stmt of splitSql(sql)) {
        await client.query(stmt);
      }
    }
    await client.query('COMMIT');
    console.log('local db init ok');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
};
run().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
"@

  Invoke-InDir $ServerDir {
    $env:PGHOST = $LocalDb.Host
    $env:PGPORT = [string]$LocalDb.Port
    $env:PGUSER = $LocalDb.User
    $env:PGPASSWORD = $LocalDb.Password
    $env:PGDATABASE = $LocalDb.Database
    node --input-type=module -e $nodeCode @files
    if ($LASTEXITCODE -ne 0) {
      throw "本地数据库初始化失败"
    }
  }
}

function Sync-DatabaseToTest([hashtable]$LocalDb, [hashtable]$TestDb) {
  Write-Step "4/5 同步本地数据库到测试环境"

  $dumpFile = Join-Path $ScriptDir "local_to_test_dump.sql"
  if (Test-Path $dumpFile) {
    Remove-Item $dumpFile -Force
  }

  $localConn = Get-QuotedConnArg $LocalDb
  $testConn = Get-QuotedConnArg $TestDb

  & pg_dump --dbname=$localConn --no-owner --no-privileges --clean --if-exists --inserts --encoding=UTF8 --file="$dumpFile"
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump 执行失败，请确认 PostgreSQL 客户端工具已安装并加入 PATH"
  }

  & psql --dbname=$testConn --file="$dumpFile"
  if ($LASTEXITCODE -ne 0) {
    throw "psql 导入测试环境失败，请检查测试库连接信息"
  }
}

function Start-Services {
  Write-Step "5/5 启动前后端"

  Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $ApiGatewayDir -WindowStyle Normal
  Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $ServerDir -WindowStyle Normal
  Start-Process -FilePath "node" -ArgumentList ".\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5175 --strictPort" -WorkingDirectory $ClientDir -WindowStyle Normal
}

Assert-ConfigFile
. $SyncConfigPath

$envMap = Load-EnvFile (Join-Path $ServerDir ".env")
$localDb = @{
  Host = $envMap["PGHOST"]
  Port = [int]$envMap["PGPORT"]
  User = $envMap["PGUSER"]
  Password = $envMap["PGPASSWORD"]
  Database = $envMap["PGDATABASE"]
}

if (-not $SyncConfig -or -not $SyncConfig.TestDb) {
  throw "sync_config.ps1 中缺少 `$SyncConfig.TestDb 配置"
}

Run-GitPull
Build-ApiGateway
Build-Server
if ($InitLocalDb) {
  Init-LocalDatabase $localDb
}
Sync-DatabaseToTest $localDb $SyncConfig.TestDb
Start-Services

Write-Host ""
Write-Host "完成："
Write-Host "- 前端: http://localhost:5175/"
Write-Host "- 后端: http://localhost:3002/api/health"
