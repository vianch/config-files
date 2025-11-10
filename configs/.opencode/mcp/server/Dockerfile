# Use Kali Linux as the base image to have security tools available
FROM kalilinux/kali-rolling

# Set non-interactive frontend to avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install security tools, Python, and necessary utilities
# Using --no-install-recommends to keep the image size smaller
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    nikto \
    sqlmap \
    wpscan \
    dirb \
    exploitdb \
    python3 \
    python3-pip \
    procps \
    libcap2-bin \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set capabilities for nmap to allow network scanning by a non-root user
# This is crucial for running scans that require raw socket access without full root privileges
RUN setcap cap_net_raw,cap_net_admin,cap_net_bind_service+eip /usr/bin/nmap

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy the server code into the container
COPY mcp_server.py .

# Create a non-root user to run the application for better security
RUN useradd -m -u 1000 mcpuser && \
    chown -R mcpuser:mcpuser /app

# Switch to the non-root user
USER mcpuser

# Command to run the MCP server when the container starts
CMD ["python3", "mcp_server.py"]
