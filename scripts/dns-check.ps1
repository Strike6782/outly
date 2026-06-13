param(
    [Parameter(Mandatory = $true)]
    [string]$Domain
)

# DNS verification helper for outreach domains (SPF + DMARC).
Write-Host "Checking DNS for: $Domain" -ForegroundColor Cyan
Write-Host ""

function Test-TxtRecord {
    param([string]$Name, [string]$Label)
    try {
        $records = Resolve-DnsName -Name $Name -Type TXT -ErrorAction Stop
        $values = ($records | Where-Object { $_.Strings } | ForEach-Object { $_.Strings }) -join ""
        if ($values) {
            Write-Host "[OK] $Label" -ForegroundColor Green
            Write-Host "     $values"
            return $true
        }
    } catch {
        Write-Host "[MISSING] $Label" -ForegroundColor Red
        Write-Host "     No TXT record found for $Name"
        return $false
    }
    return $false
}

$spfOk = Test-TxtRecord -Name $Domain -Label "SPF (root domain TXT)"
$dmarcOk = Test-TxtRecord -Name "_dmarc.$Domain" -Label "DMARC (_dmarc TXT)"

Write-Host ""
if ($spfOk -and $dmarcOk) {
    Write-Host "Basic DNS checks passed. Verify DKIM CNAMEs in Fastmail Settings -> Domains." -ForegroundColor Green
    exit 0
}

Write-Host "Some DNS records are missing. Fix them before sending campaigns." -ForegroundColor Yellow
exit 1
