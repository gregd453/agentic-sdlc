# Shell Completions for agentic-sdlc CLI

This directory contains shell completion scripts for the `agentic-sdlc` command.

## Bash Completion

### Installation

**macOS (using Homebrew):**
```bash
cp agentic-sdlc.bash /usr/local/etc/bash_completion.d/agentic-sdlc
```

**Linux:**
```bash
sudo cp agentic-sdlc.bash /etc/bash_completion.d/agentic-sdlc
```

**Manual installation:**
Add this line to your `~/.bashrc` or `~/.bash_profile`:
```bash
source /path/to/agentic-sdlc.bash
```

### Usage

After installation, tab completion will work:
```bash
agentic-sdlc st<TAB>      # Completes to "start"
agentic-sdlc start <TAB>  # Shows available options
agentic-sdlc logs --s<TAB> # Completes to "--service"
```

## Zsh Completion

### Installation

**macOS (using Homebrew):**
```bash
cp _agentic-sdlc.zsh /usr/local/share/zsh/site-functions/_agentic-sdlc
```

**Linux:**
```bash
sudo cp _agentic-sdlc.zsh /usr/share/zsh/site-functions/_agentic-sdlc
```

**Manual installation:**
Add this to your `~/.zshrc`:
```bash
fpath=(~/.zsh/completions $fpath)
```

Then copy the completion script:
```bash
cp _agentic-sdlc.zsh ~/.zsh/completions/_agentic-sdlc
```

### Usage

Zsh completion works similarly:
```bash
agentic-sdlc st<TAB>      # Completes to "start"
agentic-sdlc logs --service <TAB>  # Shows available services
```

## Supported Completions

### Commands
- `start/up` - Start services
- `stop/down` - Stop services
- `restart/reload` - Restart services
- `status` - Show status
- `reset` - Reset environment
- `health` (all variants) - Health checks
- `logs` - View logs
- `metrics` - System metrics
- `test` (all variants) - Run tests
- `deploy` (all variants) - Deployment
- `db:*` - Database commands
- `workflows:*` - Workflow operations
- `agents:*` - Agent operations
- `config` - Configuration

### Options by Command

**start/up:**
- `--skip-build`
- `--force-build`
- `--wait`
- `--services`

**logs:**
- `--service` (with service name suggestions)
- `--follow`
- `--lines`
- `--grep`

**metrics:**
- `--service`
- `--period` (1h, 24h, 7d)

**test:**
- `--tier` (1-4)
- `--match`
- `--parallel`
- `--timeout`

**deploy:**
- `--env` (staging, production)
- `--dry-run`
- `--approve`

### Global Options
- `-v, --verbose`
- `-j, --json`
- `-y, --yaml`
- `-h, --help`
- `--version`

## Development

To update completions:

1. **Bash:** Edit `agentic-sdlc.bash` - modify the `commands` array
2. **Zsh:** Edit `_agentic-sdlc.zsh` - modify the `commands` array

Both scripts are self-contained and don't require recompilation.

## Troubleshooting

### Completions not working?

**Bash:**
```bash
# Check if completion is loaded
compgen -c | grep agentic

# Reload bash config
source ~/.bashrc
```

**Zsh:**
```bash
# Check completion path
echo $fpath

# Reload zsh config
exec zsh
```

### Verify installation
```bash
# Bash
type agentic-sdlc  # Should show it's a command

# Zsh
which _agentic-sdlc  # Should show completion path
```

## References

- [Bash Completion Documentation](https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion.html)
- [Zsh Completion Documentation](https://zsh.sourceforge.io/Doc/Release/Completion-System.html)
