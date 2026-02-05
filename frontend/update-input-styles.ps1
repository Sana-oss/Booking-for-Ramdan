$content = Get-Content 'archives.html' -Raw
$old = @"
        /* Date Range Input Styling */
        .date-range-input {
            height: 45px !important;
            padding: 0 15px !important;
            border: 1px solid rgba(212, 175, 55, 0.4) !important;
            background: rgba(255, 255, 255, 0.05) !important;
            color: white !important;
            border-radius: 8px !important;
            min-width: 200px;
        }
"@
$new = @"
        /* Date Range Input Styling - Luxury Cream Theme */
        .date-range-input {
            height: 45px !important;
            padding: 0 15px !important;
            border: 1px solid rgba(197, 160, 89, 0.5) !important;
            background: #f9f5eb !important;
            color: #333333 !important;
            border-radius: 8px !important;
            min-width: 200px;
            font-family: 'Cairo', sans-serif;
            font-weight: 600;
            font-size: 0.95rem;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
        }

        .date-range-input:focus {
            outline: none;
            border-color: #c5a059 !important;
            background: #fffef9 !important;
            color: #333333 !important;
            box-shadow: 0 0 0 2px rgba(197, 160, 89, 0.2), inset 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }

        .date-range-input::placeholder {
            color: rgba(102, 102, 102, 0.6) !important;
            font-weight: 500;
        }
"@
$content = $content.Replace($old, $new)
$content | Set-Content 'archives.html'
