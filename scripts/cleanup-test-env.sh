#!/bin/bash

###############################################################################
# Test Environment Cleanup Script
#
# Purpose: Clean up generated code and logs from test runs
# Usage: ./scripts/cleanup-test-env.sh [options]
#
# Options:
#   --all         Clean everything (ai.output + logs + pids)
#   --output      Clean only ai.output directory
#   --logs        Clean only log files
#   --pids        Clean only PID files
#   --dry-run     Show what would be deleted without deleting
#   --keep-last   Keep the most recent N workflows (default: 0)
#   -h, --help    Show this help message
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Directories
AI_OUTPUT_DIR="$PROJECT_ROOT/ai.output"
LOGS_DIR="$PROJECT_ROOT/scripts/logs"
PIDS_DIR="$PROJECT_ROOT/.pids"

# Options
DRY_RUN=false
CLEAN_OUTPUT=false
CLEAN_LOGS=false
CLEAN_PIDS=false
KEEP_LAST=0

###############################################################################
# Functions
###############################################################################

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}Test Environment Cleanup${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

show_help() {
    cat << EOF
Test Environment Cleanup Script

Usage: $0 [options]

Options:
    --all         Clean everything (ai.output + logs + pids)
    --output      Clean only ai.output directory
    --logs        Clean only log files
    --pids        Clean only PID files
    --dry-run     Show what would be deleted without deleting
    --keep-last N Keep the most recent N workflows (default: 0)
    -h, --help    Show this help message

Examples:
    # Clean everything
    $0 --all

    # Clean only logs
    $0 --logs

    # Dry run to see what would be deleted
    $0 --all --dry-run

    # Keep the 5 most recent workflows
    $0 --output --keep-last 5

    # Clean logs and pids but keep output
    $0 --logs --pids

EOF
}

get_directory_size() {
    local dir=$1
    if [ -d "$dir" ]; then
        du -sh "$dir" 2>/dev/null | cut -f1
    else
        echo "0B"
    fi
}

count_files() {
    local dir=$1
    if [ -d "$dir" ]; then
        find "$dir" -type f 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

clean_ai_output() {
    print_info "Cleaning ai.output directory..."

    if [ ! -d "$AI_OUTPUT_DIR" ]; then
        print_warning "ai.output directory does not exist"
        return
    fi

    local workflow_count=$(find "$AI_OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    local total_size=$(get_directory_size "$AI_OUTPUT_DIR")
    local file_count=$(count_files "$AI_OUTPUT_DIR")

    print_info "Found $workflow_count workflows ($file_count files, $total_size)"

    if [ "$KEEP_LAST" -gt 0 ]; then
        print_info "Keeping the $KEEP_LAST most recent workflows..."

        # Get workflows sorted by modification time, skip the newest N
        local workflows_to_delete=$(find "$AI_OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | \
            sort -rn | \
            tail -n +$((KEEP_LAST + 1)) | \
            cut -d' ' -f2-)

        if [ -z "$workflows_to_delete" ]; then
            print_success "No workflows to delete (keeping $KEEP_LAST most recent)"
            return
        fi

        local delete_count=$(echo "$workflows_to_delete" | wc -l)
        print_info "Deleting $delete_count older workflows..."

        while IFS= read -r workflow_dir; do
            if [ "$DRY_RUN" = true ]; then
                echo "  [DRY RUN] Would delete: $(basename "$workflow_dir")"
            else
                rm -rf "$workflow_dir"
                print_success "Deleted: $(basename "$workflow_dir")"
            fi
        done <<< "$workflows_to_delete"
    else
        # Delete all workflows
        if [ "$DRY_RUN" = true ]; then
            echo "  [DRY RUN] Would delete: $AI_OUTPUT_DIR/* ($workflow_count workflows)"
        else
            rm -rf "${AI_OUTPUT_DIR:?}"/*
            print_success "Deleted $workflow_count workflows ($file_count files, freed $total_size)"
        fi
    fi
}

clean_logs() {
    print_info "Cleaning log files..."

    if [ ! -d "$LOGS_DIR" ]; then
        print_warning "logs directory does not exist"
        return
    fi

    local log_count=$(find "$LOGS_DIR" -type f -name "*.log" 2>/dev/null | wc -l | tr -d ' ')
    local total_size=$(get_directory_size "$LOGS_DIR")

    if [ "$log_count" -eq 0 ]; then
        print_warning "No log files found"
        return
    fi

    print_info "Found $log_count log files ($total_size)"

    if [ "$DRY_RUN" = true ]; then
        find "$LOGS_DIR" -type f -name "*.log" 2>/dev/null | while read -r log_file; do
            echo "  [DRY RUN] Would delete: $(basename "$log_file")"
        done
    else
        find "$LOGS_DIR" -type f -name "*.log" -delete 2>/dev/null
        print_success "Deleted $log_count log files (freed $total_size)"
    fi
}

clean_pids() {
    print_info "Cleaning PID files..."

    if [ ! -d "$PIDS_DIR" ]; then
        print_warning ".pids directory does not exist"
        return
    fi

    local pid_count=$(find "$PIDS_DIR" -type f -name "*.pid*" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$pid_count" -eq 0 ]; then
        print_warning "No PID files found"
        return
    fi

    print_info "Found $pid_count PID files"

    if [ "$DRY_RUN" = true ]; then
        find "$PIDS_DIR" -type f -name "*.pid*" 2>/dev/null | while read -r pid_file; do
            echo "  [DRY RUN] Would delete: $(basename "$pid_file")"
        done
    else
        find "$PIDS_DIR" -type f -name "*.pid*" -delete 2>/dev/null
        print_success "Deleted $pid_count PID files"
    fi
}

show_summary() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}Summary${NC}"
    echo -e "${BLUE}================================================${NC}"

    if [ -d "$AI_OUTPUT_DIR" ]; then
        local workflow_count=$(find "$AI_OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        local output_size=$(get_directory_size "$AI_OUTPUT_DIR")
        echo "ai.output: $workflow_count workflows ($output_size)"
    else
        echo "ai.output: [does not exist]"
    fi

    if [ -d "$LOGS_DIR" ]; then
        local log_count=$(find "$LOGS_DIR" -type f -name "*.log" 2>/dev/null | wc -l | tr -d ' ')
        local log_size=$(get_directory_size "$LOGS_DIR")
        echo "logs:      $log_count files ($log_size)"
    else
        echo "logs:      [does not exist]"
    fi

    if [ -d "$PIDS_DIR" ]; then
        local pid_count=$(find "$PIDS_DIR" -type f -name "*.pid*" 2>/dev/null | wc -l | tr -d ' ')
        echo "pids:      $pid_count files"
    else
        echo "pids:      [does not exist]"
    fi

    echo ""
}

###############################################################################
# Main Script
###############################################################################

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            CLEAN_OUTPUT=true
            CLEAN_LOGS=true
            CLEAN_PIDS=true
            shift
            ;;
        --output)
            CLEAN_OUTPUT=true
            shift
            ;;
        --logs)
            CLEAN_LOGS=true
            shift
            ;;
        --pids)
            CLEAN_PIDS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --keep-last)
            KEEP_LAST="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# If no options specified, default to --all
if [ "$CLEAN_OUTPUT" = false ] && [ "$CLEAN_LOGS" = false ] && [ "$CLEAN_PIDS" = false ]; then
    print_warning "No options specified, defaulting to --all"
    CLEAN_OUTPUT=true
    CLEAN_LOGS=true
    CLEAN_PIDS=true
fi

# Show header
print_header

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No files will be deleted"
    echo ""
fi

# Show current state
echo "Current state:"
show_summary

# Confirm unless dry run
if [ "$DRY_RUN" = false ]; then
    echo ""
    read -p "Proceed with cleanup? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleanup cancelled"
        exit 0
    fi
    echo ""
fi

# Perform cleanup
if [ "$CLEAN_OUTPUT" = true ]; then
    clean_ai_output
    echo ""
fi

if [ "$CLEAN_LOGS" = true ]; then
    clean_logs
    echo ""
fi

if [ "$CLEAN_PIDS" = true ]; then
    clean_pids
    echo ""
fi

# Show final state
if [ "$DRY_RUN" = false ]; then
    echo "Final state:"
    show_summary
    print_success "Cleanup complete!"
else
    echo ""
    print_info "Dry run complete. Run without --dry-run to actually delete files."
fi

echo ""
