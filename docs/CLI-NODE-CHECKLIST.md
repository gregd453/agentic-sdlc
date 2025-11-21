# CLI & Node.js Best Practices Checklist

## ✅ Shell Scripts Best Practices

### 1. Error Handling
- [ ] Use `set -e` to exit on errors
- [ ] Use `set -u` to error on undefined variables
- [ ] Use `set -o pipefail` for pipeline errors
- [ ] Implement proper error messages with context
- [ ] Use trap for cleanup on exit

### 2. Portability
- [ ] Use `#!/bin/bash` shebang (or `/usr/bin/env bash`)
- [ ] Check for required commands before using them
- [ ] Use POSIX-compliant syntax when possible
- [ ] Quote variables to prevent word splitting
- [ ] Use `$()` instead of backticks

### 3. User Experience
- [ ] Provide clear usage/help messages
- [ ] Use colored output for better readability
- [ ] Show progress indicators for long operations
- [ ] Confirm destructive operations
- [ ] Provide verbose/debug modes

### 4. Security
- [ ] Never echo passwords or API keys
- [ ] Use `read -s` for sensitive input
- [ ] Validate user input
- [ ] Use secure temporary files (`mktemp`)
- [ ] Set proper file permissions

### 5. Maintainability
- [ ] Add comments for complex logic
- [ ] Use functions for reusable code
- [ ] Follow consistent naming conventions
- [ ] Keep functions small and focused
- [ ] Document script version and purpose

---

## ✅ Node.js Server Best Practices

### 1. Process Management
- [ ] Handle uncaught exceptions gracefully
- [ ] Handle unhandled promise rejections
- [ ] Implement graceful shutdown (SIGTERM, SIGINT)
- [ ] Use process managers (PM2, systemd)
- [ ] Set process titles for identification

### 2. Error Handling
- [ ] Use structured error logging
- [ ] Implement error monitoring (Sentry, etc.)
- [ ] Return appropriate HTTP status codes
- [ ] Never expose stack traces in production
- [ ] Use error boundaries/middleware

### 3. Performance
- [ ] Use clustering for CPU-intensive tasks
- [ ] Implement connection pooling (DB, Redis)
- [ ] Use caching strategies
- [ ] Enable compression (gzip, brotli)
- [ ] Monitor memory usage and prevent leaks

### 4. Security
- [ ] Validate and sanitize all inputs
- [ ] Use environment variables for secrets
- [ ] Enable CORS with proper configuration
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Use helmet.js or equivalent
- [ ] Keep dependencies updated

### 5. Logging & Monitoring
- [ ] Use structured logging (JSON)
- [ ] Include request IDs for tracing
- [ ] Log at appropriate levels
- [ ] Implement health check endpoints
- [ ] Monitor metrics (response time, errors)

### 6. Configuration
- [ ] Use environment-based configuration
- [ ] Validate configuration on startup
- [ ] Provide sensible defaults
- [ ] Document all environment variables
- [ ] Use .env.example for reference

---

## ✅ CLI Tools Best Practices

### 1. User Interface
- [ ] Provide `--help` and `-h` flags
- [ ] Support `--version` and `-v` flags
- [ ] Use consistent argument parsing
- [ ] Support both long and short flags
- [ ] Provide examples in help text

### 2. Exit Codes
- [ ] Use `0` for success
- [ ] Use non-zero for errors (1-255)
- [ ] Document exit codes
- [ ] Use different codes for different errors
- [ ] Return exit codes properly

### 3. Input/Output
- [ ] Support piping (stdin/stdout)
- [ ] Provide quiet mode (`-q`, `--quiet`)
- [ ] Provide verbose mode (`-v`, `--verbose`)
- [ ] Use stderr for errors and warnings
- [ ] Support JSON output for scripting

### 4. Configuration
- [ ] Support config files
- [ ] Support environment variables
- [ ] Support command-line flags
- [ ] Document precedence order
- [ ] Validate configuration

### 5. Testing
- [ ] Test CLI with different inputs
- [ ] Test error scenarios
- [ ] Test help/version commands
- [ ] Mock external dependencies
- [ ] Test signal handling

---

## ✅ Package.json Scripts Best Practices

### 1. Standard Scripts
- [ ] Provide `start` script
- [ ] Provide `test` script
- [ ] Provide `build` script
- [ ] Provide `dev` script for development
- [ ] Provide `lint` script

### 2. Cross-Platform Compatibility
- [ ] Use cross-env for environment variables
- [ ] Use rimraf instead of `rm -rf`
- [ ] Use cross-platform path separators
- [ ] Test on Windows, macOS, and Linux

### 3. CI/CD Integration
- [ ] Provide `ci` script for CI environments
- [ ] Separate build and test steps
- [ ] Generate coverage reports
- [ ] Support parallel execution
- [ ] Clean before builds

### 4. Documentation
- [ ] Document all custom scripts
- [ ] Provide script descriptions in README
- [ ] Include examples
- [ ] Document required environment variables

---

## ✅ Docker & Container Best Practices

### 1. Dockerfile
- [ ] Use specific base image versions
- [ ] Use multi-stage builds
- [ ] Minimize layers
- [ ] Use .dockerignore
- [ ] Run as non-root user

### 2. Docker Compose
- [ ] Pin service versions
- [ ] Use health checks
- [ ] Set resource limits
- [ ] Use named volumes
- [ ] Provide environment file templates

### 3. Security
- [ ] Scan images for vulnerabilities
- [ ] Use minimal base images
- [ ] Don't store secrets in images
- [ ] Use secrets management
- [ ] Keep images updated

---

## ✅ Database Best Practices

### 1. Connections
- [ ] Use connection pooling
- [ ] Handle connection failures
- [ ] Implement retry logic
- [ ] Close connections properly
- [ ] Monitor connection counts

### 2. Migrations
- [ ] Version all migrations
- [ ] Test migrations (up and down)
- [ ] Back up before migrations
- [ ] Make migrations idempotent
- [ ] Document breaking changes

### 3. Security
- [ ] Use parameterized queries
- [ ] Implement least privilege access
- [ ] Encrypt sensitive data
- [ ] Audit database access
- [ ] Regular backups

---

## ✅ Testing Best Practices

### 1. Coverage
- [ ] Aim for >80% code coverage
- [ ] Test critical paths thoroughly
- [ ] Test error scenarios
- [ ] Test edge cases
- [ ] Test async operations

### 2. Organization
- [ ] Group related tests
- [ ] Use descriptive test names
- [ ] Follow AAA pattern (Arrange, Act, Assert)
- [ ] Keep tests independent
- [ ] Clean up after tests

### 3. Performance
- [ ] Use test fixtures efficiently
- [ ] Mock external dependencies
- [ ] Run tests in parallel
- [ ] Set appropriate timeouts
- [ ] Avoid test interdependencies

---

## ✅ Development Workflow

### 1. Git
- [ ] Use conventional commits
- [ ] Write meaningful commit messages
- [ ] Create feature branches
- [ ] Use pull requests
- [ ] Tag releases

### 2. Code Quality
- [ ] Use linting (ESLint, etc.)
- [ ] Use formatting (Prettier)
- [ ] Run type checking
- [ ] Review code before merging
- [ ] Use pre-commit hooks

### 3. Documentation
- [ ] Maintain README.md
- [ ] Document API endpoints
- [ ] Provide setup instructions
- [ ] Document architecture decisions
- [ ] Keep changelog updated
