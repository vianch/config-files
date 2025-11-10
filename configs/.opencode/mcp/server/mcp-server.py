#!/usr/bin/env python3
"""
MCP Server for Penetration Testing Tools - Provides access to security tools in a sandboxed environment.
"""
import os
import sys
import logging
import subprocess
import shlex
from mcp.server.fastmcp import FastMCP

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("mcp-server")

# Initialize MCP server
mcp = FastMCP("mcp_server")

# === UTILITY FUNCTIONS ===

def _run_command(command_parts: list, timeout: int = 300) -> str:
    """A helper function to securely run shell commands and return their output."""
    tool_name = command_parts[0]
    logger.info(f"Executing command: {' '.join(command_parts)}")
    try:
        result = subprocess.run(
            command_parts,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False  # We handle the return code manually
        )

        output = f"✅ {tool_name} finished with exit code {result.returncode}\n"
        if result.stdout:
            output += f"--- STDOUT ---\n{result.stdout.strip()}\n"
        if result.stderr:
            output += f"--- STDERR ---\n{result.stderr.strip()}\n"
        
        # Limit output size to prevent flooding
        if len(output) > 10000:
            output = output[:10000] + "\n... (output truncated)"
            
        return output

    except FileNotFoundError:
        logger.error(f"{tool_name} command not found. Is it installed in the container?")
        return f"❌ Error: {tool_name} command not found. The server environment is misconfigured."
    except subprocess.TimeoutExpired:
        logger.warning(f"{tool_name} command timed out after {timeout} seconds.")
        return f"⏱️ Command timed out after {timeout} seconds."
    except Exception as e:
        logger.error(f"An unexpected error occurred while running {tool_name}: {e}")
        return f"❌ An unexpected error occurred: {str(e)}"

# === MCP TOOLS ===

@mcp.tool()
async def run_nmap(target: str = "", options: str = "-sV") -> str:
    """Runs an nmap scan on a target with optional arguments."""
    if not target.strip():
        return "❌ Error: Target is required for nmap scan."
    
    command = ["nmap"]
    if options:
        command.extend(shlex.split(options))
    command.append(target.strip())
    
    return _run_command(command, timeout=600) # 10 minute timeout for nmap

@mcp.tool()
async def run_nikto(target_url: str = "", options: str = "") -> str:
    """Runs a Nikto web server scan on a target URL."""
    if not target_url.strip():
        return "❌ Error: Target URL is required for Nikto scan."
    
    command = ["nikto", "-h", target_url.strip()]
    if options:
        command.extend(shlex.split(options))
        
    return _run_command(command, timeout=600) # 10 minute timeout for nikto

@mcp.tool()
async def run_sqlmap(target_url: str = "", options: str = "--batch") -> str:
    """Runs sqlmap to check for SQL injection vulnerabilities."""
    if not target_url.strip():
        return "❌ Error: Target URL is required for sqlmap."
        
    command = ["sqlmap", "-u", target_url.strip()]
    if options:
        command.extend(shlex.split(options))
    
    return _run_command(command, timeout=600) # 10 minute timeout for sqlmap

@mcp.tool()
async def run_wpscan(target_url: str = "", options: str = "") -> str:
    """Runs wpscan to check for WordPress vulnerabilities."""
    if not target_url.strip():
        return "❌ Error: Target URL is required for wpscan."
        
    command = ["wpscan", "--url", target_url.strip()]
    if options:
        command.extend(shlex.split(options))
        
    return _run_command(command)

@mcp.tool()
async def run_dirb(target_url: str = "", wordlist: str = "/usr/share/wordlists/dirb/common.txt") -> str:
    """Runs dirb to discover directories and files on a web server."""
    if not target_url.strip():
        return "❌ Error: Target URL is required for dirb."
    
    # Basic path traversal check for wordlist
    safe_wordlist = os.path.abspath(wordlist)
    if not safe_wordlist.startswith("/usr/share/wordlists/"):
        return "❌ Error: For security, only wordlists from /usr/share/wordlists/ are allowed."
    if not os.path.exists(safe_wordlist):
        return f"❌ Error: Wordlist not found at {safe_wordlist}"

    command = ["dirb", target_url.strip(), safe_wordlist]
    return _run_command(command)

@mcp.tool()
async def run_searchsploit(query: str = "", options: str = "") -> str:
    """Uses searchsploit to find exploits in the Exploit-DB database."""
    if not query.strip():
        return "❌ Error: Search query is required for searchsploit."
        
    command = ["searchsploit"]
    if options:
        command.extend(shlex.split(options))
    command.extend(shlex.split(query))
    
    return _run_command(command)

# === SERVER STARTUP ===
if __name__ == "__main__":
    logger.info("Starting mcp Tools MCP server...")
    logger.warning("⚠️ This server provides access to powerful security tools.")
    logger.warning("⚠️ Use it responsibly and only on systems you are authorized to test.")
    
    try:
        mcp.run(transport='stdio')
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
