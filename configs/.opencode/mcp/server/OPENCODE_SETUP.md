# mcp Tools MCP Server - OpenCode Setup Guide

## ✅ Setup Complete!

Your mcp Tools MCP server has been successfully configured for OpenCode.

## What Was Done

### 1. Files Created
- **Dockerfile** - Kali Linux container with security tools
- **requirements.txt** - Python dependencies (mcp[cli])
- **mcp_server.py** - MCP server implementation with 6 security tools
- **readme.txt** - Complete documentation
- **CLAUDE.md** - Guidelines for AI interaction

### 2. Docker Image Built
- Image name: `mcp-server-mcp:latest`
- Base: Kali Linux Rolling
- Includes: nmap, nikto, sqlmap, wpscan, dirb, exploitdb
- Security: Runs as non-root user (mcpuser)

### 3. OpenCode Configuration
- Location: `~/.config/opencode/opencode.json`
- Server name: `mcp-server`
- Status: **Enabled**

## Available Tools

Once the OpenCode session restarts or reconnects, you'll have access to:

1. **`run_nmap(target, options)`** - Network scanning and security auditing
2. **`run_nikto(target_url, options)`** - Web server vulnerability scanning
3. **`run_sqlmap(target_url, options)`** - SQL injection detection
4. **`run_wpscan(target_url, options)`** - WordPress security scanning
5. **`run_dirb(target_url, wordlist)`** - Directory and file discovery
6. **`run_searchsploit(query, options)`** - Exploit database search

## How to Use in OpenCode

After the current session reconnects (or you restart OpenCode), you can ask Claude to use these tools:

```
"Run an nmap scan on scanme.nmap.org"
"Search for Apache vulnerabilities with searchsploit"
"Use nikto to scan http://testphp.vulnweb.com/"
```

## Verifying the Setup

To verify the server is working, you can run:

```bash
docker run -i --rm mcp-server-mcp:latest
```

Then interact with it using MCP protocol JSON-RPC messages.

## Configuration Details

### OpenCode Config Location
```
~/.config/opencode/opencode.json
```

### Current Configuration
```json
{
  "mcp": {
    "mcp-server": {
      "type": "local",
      "command": [
        "docker",
        "run",
        "-i",
        "--rm",
        "mcp-server-mcp"
      ],
      "enabled": true
    }
  }
}
```

### Claude Desktop Config (Already Updated)
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

The custom catalog has been added to load the mcp-server through the MCP gateway.

## Important Security Notes

⚠️ **WARNING**: These tools are powerful and should only be used on systems you own or have explicit permission to test.

- Unauthorized scanning is illegal
- Always get written permission before testing
- Be aware of rate limiting and network policies
- Use responsibly for educational purposes

## Troubleshooting

### Tools Not Appearing in OpenCode
1. Restart your OpenCode session
2. Check if Docker is running: `docker ps`
3. Verify the image exists: `docker images | grep mcp`
4. Check configuration: `cat ~/.config/opencode/opencode.json`

### Docker Permission Issues
If you get permission errors, ensure:
- Docker Desktop is running
- Your user has Docker permissions
- The Docker socket is accessible

### Server Not Starting
Check the container logs:
```bash
docker run -it --rm mcp-server-mcp:latest /bin/bash
```

Then manually test:
```bash
python3 mcp_server.py
```

## Next Steps

1. **Test in OpenCode**: Ask Claude to use one of the mcping tools
2. **Read Documentation**: Check `readme.txt` for detailed usage examples
3. **Explore Tools**: Try each tool on authorized test targets
4. **Customize**: Add new tools by editing the Dockerfile and mcp_server.py

## File Locations

All files are in: `.opencode/mcp/mcp-mcp-server/`
- Dockerfile
- requirements.txt  
- mcp_server.py
- readme.txt
- CLAUDE.md
- OPENCODE_SETUP.md (this file)

## Support

For issues or questions:
- Check the readme.txt file for detailed documentation
- Review CLAUDE.md for AI interaction guidelines
- Verify Docker container is running correctly

---

**Status**: ✅ Ready to use in OpenCode
**Last Updated**: 2025-11-06
