#!/usr/bin/env bash
# macos_audit_anti_slop.sh
# Deterministic Static Anti-Slop & Security Linter for Native macOS Applications
# Source: https://share.gemini.google/pyyN3r6iHRki · Qoder / Gemi Anti-Slop Specification
set -euo pipefail

TARGET_DIR="${1:-.}"
SOURCES_DIR="${TARGET_DIR}/Sources"

if [ ! -d "$SOURCES_DIR" ]; then
  if [ -d "${TARGET_DIR}/src" ]; then
    SOURCES_DIR="${TARGET_DIR}/src"
  else
    SOURCES_DIR="${TARGET_DIR}"
  fi
fi

ERRORS=0

echo "🔍 [Qoder/Gemi] Running macOS Native Anti-Slop & Security Audit on: ${SOURCES_DIR}"

check_forbidden() {
  local pattern="$1"
  local message="$2"
  if grep -rnE "$pattern" "$SOURCES_DIR" --exclude="*audit-anti-slop.sh*" --exclude="*SPEC.md*" --exclude-dir=".git" --exclude-dir="DerivedData" --exclude-dir="build" >/dev/null 2>&1; then
    echo "❌ [VIOLATION] $message"
    grep -rnE "$pattern" "$SOURCES_DIR" --exclude="*audit-anti-slop.sh*" --exclude="*SPEC.md*" --exclude-dir=".git" --exclude-dir="DerivedData" --exclude-dir="build"
    ERRORS=$((ERRORS + 1))
  fi
}

# 1. Platform Leakage Check (iOS to macOS Hallucinations)
check_forbidden "import UIKit|UIScreen|UIColor|navigationBarTitleDisplayMode|UIImpactFeedbackGenerator|\.keyboardType\(" \
  "iOS/UIKit API detected in macOS target. Use AppKit/NSColor/macOS SwiftUI equivalents."

# 2. UI/UX Anti-Slop Checks
check_forbidden "LinearGradient|RadialGradient|AngularGradient" \
  "Decorative gradient detected (AI Slop risk). Use native macOS semantic colors or .regularMaterial/.ultraThinMaterial."

check_forbidden "scaleEffect\(1\.0[1-9]\)" \
  "Web-style hover scale effect detected. Use native macOS control styles and subtle highlight states."

check_forbidden "Supercharge|Unlock seamless|Elevate your workflow|🚀|✨|⚡" \
  "AI marketing fluff or emoji icon detected. Use concise technical copy and native SF Symbols."

check_forbidden "\.onTapGesture\s*\{" \
  "Non-semantic tap gesture detected. Use native Button with proper accessibility, focus, and keyboard shortcuts."

# 3. Security Checks (Least Privilege & Zero Plaintext Secrets)
check_forbidden "(apiKey|secret|password|token)\s*=\s*\"[A-Za-z0-9_\-]{8,}\"" \
  "Potential hardcoded secret detected. Store sensitive tokens in macOS Keychain (Security framework)."

check_forbidden "Process\(\)\.arguments\s*=\s*\[.*\"sh\",.*\"-c\"" \
  "Shell injection risk detected in Process invocation. Pass executable arguments directly as an array without shell interpolation."

if [ "$ERRORS" -gt 0 ]; then
  echo "⛔ Audit FAILED with $ERRORS violation(s). Resolve all issues above before proceeding to packaging."
  exit 1
else
  echo "✅ Anti-Slop & Security Audit PASSED! Code conforms to macOS Native HIG standards."
  exit 0
fi
