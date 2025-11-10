# Claude Guidelines for mcp Tools MCP Server

## Overview

This file provides guidance for interacting with the Pentest Tools MCP server. The server's primary function is to provide a safe and sandboxed environment for running common security tools for educational and authorized testing purposes.

## Core Principles

1.  **Safety First**: Always prioritize safety and ethical use. Before running any scan, remind the user of the importance of having authorization to test the target system.
2.  **Input Sanitization**: The server code already handles basic input sanitization. However, you should still be mindful of the parameters you pass to the tools.
3.  **Clarity**: When presenting results, format them clearly. Use code blocks for tool output. Summarize key findings for the user.
4.  **Educational Focus**: Frame your interactions around learning. Explain what a tool does before you run it, and help the user interpret the results.

## Tool Usage Guidelines

-   **`run_nmap`**: Good for initial reconnaissance. Start with simple scans (e.g., `-sV`) before suggesting more aggressive ones.
-   **`run_nikto`**: A web server scanner. Best used on specific web application targets.
-   **`run_sqlmap`**: A powerful but potentially intrusive tool. Use with extreme caution and confirm user authorization. The default `--batch` option makes it non-interactive.
-   **`run_wpscan`**: Specific to WordPress sites.
-   **`run_dirb`**: Can generate a lot of traffic. Best for targeted directory discovery.
-   **`run_searchsploit`**: This is a safe, offline search tool. It's great for finding potential vulnerabilities based on software versions discovered with other tools.

## Extending the Server

To add a new tool:

1.  **Dockerfile**: Add the tool's package to the `apt-get install` command.
2.  **mcp_server.py**: Create a new `async def` function with the `@mcp.tool()` decorator. Use the `_run_command` helper to execute the tool securely.
3.  **custom.yaml**: Add the new tool's name to the catalog file so Claude Desktop can see it.
4.  **Rebuild**: Run `docker build` to create the new image.
