[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SUPABASE_URL = "postgresql://postgres.vdbwazvaxgvsgpkzyoxo:Roles38225544@aws-1-us-west-2.pooler.supabase.com:6543/postgres"

# 1. BACKUP MYSQL
docker exec roles_mysql sh -c "mysqldump --default-character-set=utf8mb4 -u root -p265 roles_db" |
Set-Content -Encoding utf8 backend/db-init/backup.sql

docker exec roles_mysql sh -c "mysqldump --default-character-set=utf8mb4 -u root -p265 roles_db" |
Set-Content -Encoding utf8 backend/db-init/reservas/backup_reserva.sql

Write-Host "OK - Backup MySQL atualizado"

# 2. CONVERTE MYSQL PARA POSTGRESQL
$sql = Get-Content backend/db-init/backup.sql -Raw -Encoding utf8

# Remove blocos de comentario /*!...*/
$sql = [regex]::Replace($sql, '(?s)/\*!.*?\*/', '')

# Remove comandos MySQL especificos
$sql = [regex]::Replace($sql, '(?m)^SET\s+.*?;[\r\n]*', '')
$sql = [regex]::Replace($sql, '(?m)^LOCK TABLES.*?;[\r\n]*', '')
$sql = [regex]::Replace($sql, '(?m)^UNLOCK TABLES;[\r\n]*', '')
$sql = [regex]::Replace($sql, '(?m)^USE\s+.*?;[\r\n]*', '')

# Remove opcoes de tabela MySQL
$sql = $sql -replace '\s*ENGINE\s*=\s*\w+', ''
$sql = $sql -replace '\s*DEFAULT CHARSET\s*=\s*[\w\d]+', ''
$sql = $sql -replace '\s*COLLATE\s*=?\s*\S+', ''
$sql = $sql -replace '\s*AUTO_INCREMENT\s*=\s*\d+', ''
$sql = $sql -replace '\s*ROW_FORMAT\s*=\s*\w+', ''

# Converte ENUM para VARCHAR(50)
$sql = [regex]::Replace($sql, "(?i)enum\([^)]+\)", "VARCHAR(50)")

# Converte tipos MySQL para PostgreSQL (ordem importa - mais especifico primeiro)
$sql = [regex]::Replace($sql, '(?i)\bint\s+NOT NULL\s+AUTO_INCREMENT\b', 'SERIAL NOT NULL')
$sql = [regex]::Replace($sql, '(?i)\bint\s+DEFAULT NULL\s+AUTO_INCREMENT\b', 'SERIAL')
$sql = $sql -replace '(?i)\bAUTO_INCREMENT\b', ''
$sql = [regex]::Replace($sql, '(?i)\bSMALLINT\(\s*\d+\s*\)', 'SMALLINT')
$sql = [regex]::Replace($sql, '(?i)\bTINYINT\(\s*\d+\s*\)', 'SMALLINT')
$sql = $sql -replace '(?i)\bTINYINT\b', 'SMALLINT'
$sql = [regex]::Replace($sql, '(?i)\bBIGINT\(\s*\d+\s*\)', 'BIGINT')
$sql = [regex]::Replace($sql, '(?i)\bINT\(\s*\d+\s*\)', 'INT')
$sql = $sql -replace '(?i)\bDATETIME\b', 'TIMESTAMP'
$sql = $sql -replace '(?i)\bLONGTEXT\b', 'TEXT'
$sql = $sql -replace '(?i)\bMEDIUMTEXT\b', 'TEXT'
$sql = $sql -replace '(?i)\bDOUBLE\b', 'DOUBLE PRECISION'
$sql = $sql -replace '(?i)\bFLOAT\b', 'REAL'
$sql = $sql -replace '(?i)\bUNSIGNED\b', ''

# Remove ON UPDATE CURRENT_TIMESTAMP
$sql = $sql -replace '(?i)\s*ON UPDATE CURRENT_TIMESTAMP', ''

# Remove KEY e UNIQUE KEY dentro de CREATE TABLE (linhas com virgula antes)
$sql = [regex]::Replace($sql, '(?m),\s*(UNIQUE KEY|KEY)\s+`[^`]+`\s*\([^)]+\)', '')

# Remove PRIMARY KEY duplicado que nao seja inline
# (mysqldump as vezes coloca PRIMARY KEY (`id`) no final da tabela junto com KEY -- ja tratado acima)

# Remove backticks
$sql = $sql -replace '`', '"'

# DROP TABLE com CASCADE
$sql = [regex]::Replace($sql, 'DROP TABLE IF EXISTS "(\w+)";', 'DROP TABLE IF EXISTS "$1" CASCADE;')

# CREATE TABLE
$sql = [regex]::Replace($sql, 'CREATE TABLE IF NOT EXISTS "(\w+)"', 'CREATE TABLE IF NOT EXISTS "$1"')
$sql = [regex]::Replace($sql, 'CREATE TABLE "(\w+)"', 'CREATE TABLE IF NOT EXISTS "$1"')

# INSERT INTO
$sql = [regex]::Replace($sql, 'INSERT INTO "(\w+)"', 'INSERT INTO "$1"')

# 3. REORDENA as tabelas na ordem correta de dependencia FK
# Ordem: usuarios -> estabelecimentos -> eventos -> tipos_ingresso
#        -> pedidos -> ingressos -> avaliacoes -> contatos -> contato_respostas

$tableOrder = @(
    'usuarios',
    'estabelecimentos',
    'eventos',
    'tipos_ingresso',
    'pedidos',
    'ingressos',
    'visitas',
    'login_historico',
    'avaliacoes',
    'contatos',
    'contato_respostas'
)

# Extrai cada bloco CREATE TABLE + INSERT INTO por tabela
$blocks = @{}
foreach ($tbl in $tableOrder) {
    # Captura DROP TABLE
    $dropMatch = [regex]::Match($sql, "(?s)(DROP TABLE IF EXISTS ""$tbl"" CASCADE;)")
    $drop = if ($dropMatch.Success) { $dropMatch.Value + "`n" } else { "" }

    # Captura CREATE TABLE ... ; (ate o ponto-virgula fechando o bloco)
    $createMatch = [regex]::Match($sql, "(?s)(CREATE TABLE IF NOT EXISTS ""$tbl"".*?\);)")
    $create = if ($createMatch.Success) { $createMatch.Value + "`n" } else { "" }

    # Captura todos os INSERTs para essa tabela
    $insertMatches = [regex]::Matches($sql, "(?m)(INSERT INTO ""$tbl""[^\n]+)")
    $inserts = ($insertMatches | ForEach-Object { $_.Value }) -join "`n"
    if ($inserts) { $inserts += "`n" }

    $truncate = "TRUNCATE TABLE ""$tbl"" RESTART IDENTITY CASCADE;`n"
$blocks[$tbl] = $drop + $create + "`n" + $truncate + $inserts
}

# Monta SQL final ordenado
$ordered = $tableOrder | ForEach-Object { $blocks[$_] }
$body = $ordered -join "`n"

# Cabecalho e rodape
$header = @"
SET session_replication_role = replica;

"@

$footer = @"

SET session_replication_role = DEFAULT;
"@

$finalSql = $header + $body + $footer

# Salva restore_postgres.sql
Set-Content -Path restore_postgres.sql -Value $finalSql -Encoding utf8

Write-Host "OK - restore_postgres.sql atualizado"

# 4. APLICA NO SUPABASE
Write-Host "Aplicando no Supabase..."

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $SUPABASE_URL -f restore_postgres.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Supabase atualizado com sucesso!"
} else {
    Write-Host "AVISO - Aplicado com erros, verifique o log acima"
}

# 5.5 AJUSTA AS SEQUENCES (corrige erro de duplicate key após restore)
Write-Host "Ajustando sequences..."

$seqSql = @"
SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('estabelecimentos', 'id'), COALESCE((SELECT MAX(id) FROM estabelecimentos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('eventos', 'id'), COALESCE((SELECT MAX(id) FROM eventos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('tipos_ingresso', 'id'), COALESCE((SELECT MAX(id) FROM tipos_ingresso), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('pedidos', 'id'), COALESCE((SELECT MAX(id) FROM pedidos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('ingressos', 'id'), COALESCE((SELECT MAX(id) FROM ingressos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('visitas', 'id'), COALESCE((SELECT MAX(id) FROM visitas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('login_historico', 'id'), COALESCE((SELECT MAX(id) FROM login_historico), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('avaliacoes', 'id'), COALESCE((SELECT MAX(id) FROM avaliacoes), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('contatos', 'id'), COALESCE((SELECT MAX(id) FROM contatos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('contato_respostas', 'id'), COALESCE((SELECT MAX(id) FROM contato_respostas), 0) + 1, false);
"@

$seqFile = "fix_sequences.sql"
Set-Content -Path $seqFile -Value $seqSql -Encoding utf8

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $SUPABASE_URL -f $seqFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Sequences ajustadas com sucesso!"
} else {
    Write-Host "AVISO - Erro ao ajustar sequences, verifique o log acima"
}

Remove-Item $seqFile -ErrorAction SilentlyContinue

# 5. APLICA ROW LEVEL SECURITY
Write-Host "Aplicando Row Level Security..."

$rlsSql = @"
-- Habilita RLS em todas as tabelas
ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estabelecimentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_ingresso     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingressos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_historico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contato_respostas  ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas para nao duplicar
DROP POLICY IF EXISTS "leitura publica" ON usuarios;
DROP POLICY IF EXISTS "leitura publica" ON estabelecimentos;
DROP POLICY IF EXISTS "leitura publica" ON eventos;
DROP POLICY IF EXISTS "leitura publica" ON tipos_ingresso;
DROP POLICY IF EXISTS "leitura publica" ON pedidos;
DROP POLICY IF EXISTS "leitura publica" ON ingressos;
DROP POLICY IF EXISTS "leitura publica" ON visitas;
DROP POLICY IF EXISTS "leitura publica" ON login_historico;
DROP POLICY IF EXISTS "leitura publica" ON avaliacoes;
DROP POLICY IF EXISTS "leitura publica" ON contatos;
DROP POLICY IF EXISTS "leitura publica" ON contato_respostas;

-- Policies de leitura publica (tabelas de conteudo)
CREATE POLICY "leitura publica" ON eventos           FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON estabelecimentos  FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON ingressos         FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON avaliacoes        FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON tipos_ingresso    FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON visitas           FOR SELECT USING (true);

-- Policies de acesso total (service role bypassa RLS automaticamente)
CREATE POLICY "acesso total" ON usuarios          USING (true) WITH CHECK (true);
CREATE POLICY "acesso total" ON pedidos           USING (true) WITH CHECK (true);
CREATE POLICY "acesso total" ON login_historico   USING (true) WITH CHECK (true);
CREATE POLICY "acesso total" ON contatos          USING (true) WITH CHECK (true);
CREATE POLICY "acesso total" ON contato_respostas USING (true) WITH CHECK (true);
"@

$rlsFile = "rls_policies.sql"
Set-Content -Path $rlsFile -Value $rlsSql -Encoding utf8

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $SUPABASE_URL -f $rlsFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - RLS aplicado com sucesso!"
} else {
    Write-Host "AVISO - RLS aplicado com erros, verifique o log acima"
}

# Remove arquivo temporario
Remove-Item $rlsFile -ErrorAction SilentlyContinue