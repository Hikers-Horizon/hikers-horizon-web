# Batch update trek pages to style modern-list li and avoid congestion in Know Before You Go
$allPages = @(
    "c:\Users\shiva\Clone\public_html\Twodays\Kodachadri\index.html",
    "c:\Users\shiva\Clone\public_html\Twodays\Kuduremukha\index.html",
    "c:\Users\shiva\Clone\public_html\Twodays\Kumaraparvatha\index.html",
    "c:\Users\shiva\Clone\public_html\Twodays\Netravathi\index.html",
    "c:\Users\shiva\Clone\public_html\Twodays\Tadiandamol\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Anthargange-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Kuntibetta-sunrise-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Makalidurga-sunrise-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Nandihills-sunrise-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Savandurga-sunrise-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Skandagiri-sunrise-trek-from-bangalore\index.html",
    "c:\Users\shiva\Clone\public_html\Sunrise\Uttaribetta-sunrise-trek\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Chikmagaluru\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Coorg2days\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Coorg3days\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Hampi\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Kodaikanal\index.html",
    "c:\Users\shiva\Clone\public_html\Backpacking\Wayanad\index.html"
)

$modernListLiCSS = @'
        .modern-list li {
            padding: 0.8rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            line-height: 1.6;
        }

        .modern-list li:last-child {
            border-bottom: none;
        }
'@

foreach ($page in $allPages) {
    if (-not (Test-Path $page)) { continue }
    $content = Get-Content $page -Raw
    $changed = $false
    
    # Update the modern-list block to include li styling
    if ($content -match '\.modern-list\s*\{[^}]*\}' -and $content -notmatch '\.modern-list li') {
        $content = [regex]::Replace($content, '(\.modern-list\s*\{[^}]*\})', "$1`r`n`r`n$modernListLiCSS")
        $changed = $true
    }
    
    if ($changed) {
        Set-Content -Path $page -Value $content -NoNewline
        Write-Host "FIXED MODERN LIST SPACING: $page" -ForegroundColor Green
    } else {
        Write-Host "NO CHANGE: $page" -ForegroundColor Yellow
    }
}
