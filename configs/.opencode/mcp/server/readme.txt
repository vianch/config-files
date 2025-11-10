# mcp Tools MCP Server

A Model Context Protocol (MCP) server that provides a sandboxed environment with common penetration testing tools (nmap, nikto, sqlmap, wpscan, dirb, searchsploit) for educational web mcping purposes.

## ⚠️ Disclaimer

This server is intended for educational and authorized security testing purposes only. Unauthorized scanning or exploitation of systems is illegal. Use these tools responsibly and only on networks and systems for which you have explicit permission. The user of this server is solely responsible for their actions.

## Purpose

This MCP server provides a secure and isolated interface for AI assistants to run common security scanning tools. It allows users to learn about and perform penetration tests on their own applications within a controlled environment, without needing to install these tools on their host machine.

## Features

- **`run_nmap(target, options)`** - Performs network discovery and security auditing using Nmap.
- **`run_nikto(target_url, options)`** - Scans web servers for multiple security vulnerabilities.
- **`run_sqlmap(target_url, options)`** - Automates the process of detecting and exploiting SQL injection flaws.
- **`run_wpscan(target_url, options)`** - A WordPress security scanner to find known vulnerabilities.
- **`run_dirb(target_url, wordlist)`** - Discovers hidden directories and files on web servers.
- **`run_searchsploit(query, options)`** - Searches the local Exploit-DB database for exploits.

## Prerequisites

- Docker Desktop with MCP Toolkit enabled
- Docker MCP CLI plugin (`docker mcp` command)

## Installation

See the step-by-step instructions provided with the files. This server does not require any API keys or secrets.

## Usage Examples

In Claude Desktop, you can ask:

- "Perform a service version scan on scanme.nmap.org"
- "Run a nikto scan on http://testphp.vulnweb.com/"
- "Use wpscan on a WordPress site I own at https://example.com"
- "Search for exploits related to 'Apache 2.4.52'"

## Architecture

```
Claude Desktop → MCP Gateway → mcp Tools MCP Server (Docker) → Target System
```

The server runs inside a Kali Linux Docker container, ensuring all tools and their dependencies are isolated from your host system. The container runs as a non-root user for enhanced security.

## Development

### Local Testing

You can build and run the container to test it manually.

```bash
# Build the image
docker build -t pentest-server-mcp .

# Run interactively to test commands
docker run -it --rm pentest-server-mcp /bin/bash
```

### Adding New Tools

1. Add the tool installation to the `Dockerfile` (`apt-get install -y ...`).
2. Add a new Python function in `pentest_server.py` decorated with `@mcp.tool()`.
3. Follow the existing pattern for secure command execution using `shlex` and the `_run_command` helper.
4. Update the `custom.yaml` catalog file with the new tool name.
5. Rebuild the Docker image.

## Security Considerations

- **Non-Root Execution**: The server and all tools run under a non-root `mcpuser` inside the container.
- **Command Sanitization**: All user inputs are passed to commands via `shlex.split` or are otherwise sanitized to prevent command injection vulnerabilities.
- **Network Isolation**: By default, Docker containers have limited network access. You can further restrict this using Docker's networking features if needed.
- **Resource Limits**: The tools have a default timeout to prevent long-running scans from consuming excessive resources.

## License

MIT License
